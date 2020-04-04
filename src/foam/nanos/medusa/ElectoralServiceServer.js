/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.nanos.medusa',
  name: 'ElectoralServiceServer',

  implements: [
    'foam.core.ContextAgent',
    'foam.nanos.medusa.ElectoralService',
    'foam.nanos.NanoService'
  ],

  javaImports: [
    'foam.box.HTTPBox',
    'foam.core.Agency',
    'foam.core.ContextAgent',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'static foam.mlang.MLang.*',
    'foam.net.Host',
    'foam.nanos.logger.PrefixLogger',
    'foam.nanos.logger.Logger',
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.concurrent.*',
    'java.util.concurrent.Callable',
    'java.util.concurrent.LinkedBlockingQueue',
    'java.util.concurrent.ExecutorService',
    'java.util.concurrent.Executors',
    'java.util.concurrent.RejectedExecutionException',
    'java.util.concurrent.ThreadFactory',
    'java.util.concurrent.ThreadLocalRandom',
    'java.util.concurrent.ThreadPoolExecutor',
    'java.util.concurrent.TimeUnit',
    'java.util.concurrent.atomic.AtomicInteger',
    'java.util.Date',
    'java.util.List'
  ],

  axioms: [
    {
      name: 'javaExtras',
      buildJavaClass: function(cls) {
        cls.extras.push(foam.java.Code.create({
          data: `
  private Object electionLock_ = new Object();
  private Object voteLock_ = new Object();
  protected ThreadPoolExecutor pool_ = null;
        `
        }));
      }
    }
  ],
  
  properties: [
    {
      name: 'state',
      class: 'Enum',
      of: 'foam.nanos.medusa.ElectoralServiceState',
      value: 'foam.nanos.medusa.ElectoralServiceState.ADJOURNED'
    },
    {
      name: 'electionTime',
      class: 'Long',
      value: 0
    },
    {
      name: 'votes',
      class: 'Int',
      value: 0
    },
    {
      name: 'currentSeq',
      class: 'Long',
      value: 0
    },
    {
      name: 'winner',
      class: 'String',
      value: ""
    },
    {
      name: 'threadPoolName',
      class: 'String',
      value: 'medusaThreadPool'
    },
    {
      name: 'logger',
      class: 'FObjectProperty',
      of: 'foam.nanos.logger.Logger',
      visibility: 'HIDDEN',
      transient: true,
      javaFactory: `
        return new PrefixLogger(new Object[] {
          this.getClass().getSimpleName()
        }, (Logger) getX().get("logger"));

      `
    },
  ],

  methods: [
    {
      name: 'start',
      javaCode: `
    pool_ = new ThreadPoolExecutor(
      3,
      3,
      10,
      TimeUnit.SECONDS,
      new LinkedBlockingQueue<Runnable>(),
      new ThreadFactory() {
        final AtomicInteger threadNumber = new AtomicInteger(1);

        public Thread newThread(Runnable runnable) {
          Thread thread = new Thread(
                                     Thread.currentThread().getThreadGroup(),
                                     runnable,
                                     "election" + "-" + threadNumber.getAndIncrement(),
                                     0
                                     );
          // Thread don not block server from shut down.
          thread.setDaemon(true);
          thread.setPriority(Thread.NORM_PRIORITY);
          return thread;
        }
      }
    );
    pool_.allowCoreThreadTimeOut(true);

    ((Agency) getX().get(getThreadPoolName())).submit(getX(), this, "election");
     `
    },
    {
      name: 'hasQuorum',
      type: 'Boolean',
      args: [
        {
          name: 'voters',
          type: 'Integer',
        }
      ],
      javaCode: `
      return getVotes() >= (voters / 2 + 1);
    `
    },
    {
      name: 'recordResult',
      synchronized: true,
      args: [
        {
          name: 'x',
          type: 'Context',
        },
        {
          name: 'result',
          type: 'Long',
        },
        {
          name: 'config',
          type: 'foam.nanos.medusa.ClusterConfig',
        }
      ],
      javaCode: `
      if ( result >= 0 ) {
        synchronized ( voteLock_ ) {
          setVotes(getVotes() + 1);
          if ( result > getCurrentSeq() ) {
            getLogger().debug("recordResult", config.getName(), result, "winner");
            setCurrentSeq(result);
            setWinner(config.getId());
          }
        }
      }
      getLogger().debug("recordResult", config.getName(), result, "votes", getVotes());
    `
    },
    {
      name: 'buildURL',
      args: [
        {
          name: 'config',
          type: 'foam.nanos.medusa.ClusterConfig'
        }
      ],
      type: 'String',
      javaCode: `
      try {
        // TODO: protocol - http will do for now as we are behind the load balancers.
        String address = config.getId();
        DAO hostDAO = (DAO) getX().get("hostDAO");
        Host host = (Host) hostDAO.find(config.getId());
        if ( host != null ) {
          address = host.getAddress();
        }
        java.net.URI uri = new java.net.URI("http", null, address, config.getPort(), "/service/electoralService", null, null);
        // getLogger().debug("buildURL", config.getName(), uri.toURL().toString());
        return uri.toURL().toString();
      } catch (java.net.MalformedURLException | java.net.URISyntaxException e) {
        getLogger().error(e);
        throw new RuntimeException(e);
      }
      `
    },
    {
      documentation: `Find the cluster configuration for 'this' (localhost) node.`,
      name: 'findConfig',
      type: 'foam.nanos.medusa.ClusterConfig',
      args: [
        {
          name: 'x',
          type: 'Context'
        }
      ],
      javaCode: `
      ClusterConfigService service = (ClusterConfigService) x.get("clusterConfigService");
      DAO dao = (DAO) x.get("localClusterConfigDAO");
      return (ClusterConfig) dao.find_(x, service.getConfigId());
      `
    },
    {
      documentation: 'Intended for Agency submission, so dissolve can run with  own thread.',
      name: 'dissolve',
      javaCode: `
      getLogger().debug("dissolve", "agency", "submit");
      synchronized ( electionLock_ ) {
        if ( getState() == ElectoralServiceState.ELECTION &&
            getElectionTime() > 0L ) {
          getLogger().debug("execute", "Election in progress since", getElectionTime());
        } else if ( getState() == ElectoralServiceState.VOTING ) {
          // nop
        } else {
          // run a new campaigne
          setElectionTime(System.currentTimeMillis());
          setState(ElectoralServiceState.ELECTION);

          electionLock_.notify();
        }
      }
//      ((Agency) x.get(getThreadPoolName())).submit(x, (ContextAgent)this, this.getClass().getSimpleName());
      `
    },
    {
      name: 'execute',
      args: [
        {
          name: 'x',
          type: 'Context'
        }
      ],
      javaCode: `
      // wait for first dissolve.
      synchronized ( electionLock_ ) {
        try {
          getLogger().debug("execute", "state", getState().getLabel(), "wait", "initial");
          electionLock_.wait();
        } catch (InterruptedException e) {
          return;
        }
      }

    while( true ) {
      getLogger().debug("execute", "state", getState().getLabel(), "election time", getElectionTime());
      try {
        if ( getState() != ElectoralServiceState.IN_SESSION ) {
          callVote(x);
        }
      } catch(Throwable t) {
        getLogger().error(t);
      } finally {
        synchronized ( electionLock_ ) {
          try {
            if ( getState() == ElectoralServiceState.IN_SESSION ) {
              setElectionTime(0L);
              setCurrentSeq(0L);
              getLogger().debug("execute", "state", getState().getLabel(), "wait");
              electionLock_.wait();
            }
          } catch (InterruptedException e) {
            break;
          }
        }
      }
      try {
        Thread.currentThread().sleep(2000);
      } catch (InterruptedException e) {
        return;
      }
    }
      `
    },
    {
      name: 'callVote',
      args: [
        {
          name: 'x',
          type: 'Context'
        }
      ],
      javaCode: `
      ClusterConfigService service = (ClusterConfigService) x.get("clusterConfigService");
      ClusterConfig config = service.getConfig(x, service.getConfigId());
      List voters = service.getVoters(x);

      if ( voters.size() <= 1 ) {
        // nothing to do.
        getLogger().warning("callVote", "no voters", voters.size());
        return;
      }
      getLogger().debug("callVote", "voters", voters.size());

      ThreadPoolExecutor pool = pool_;
      List<Callable<Long>> voteCallables = new ArrayList<>();
      List<Future<Long>> voteResults = null;

      try {
        setVotes(0);

        // record own vote
        recordResult(x, generateVote(x), config);

        // request votes from others
        for (int i = 0; i < voters.size(); i++) {
          ClusterConfig clientConfig = (ClusterConfig) voters.get(i);
          if ( clientConfig.getId().equals(config.getId())) {
            continue;
          }
          ClientElectoralService electoralService =
            new ClientElectoralService.Builder(getX())
             .setDelegate(new HTTPBox.Builder(getX())
               .setUrl(buildURL(clientConfig))
               .setAuthorizationType(foam.box.HTTPAuthorizationType.BEARER)
               .setSessionID(clientConfig.getSessionId())
               .setConnectTimeout(3000)
               .setReadTimeout(3000)
               .build())
             .build();
          
          voteCallables.add(() -> {
            getLogger().debug("callVote", "call", "vote", clientConfig.getName());
            try {
            long result = electoralService.vote(clientConfig.getId(), getElectionTime());
            getLogger().debug("callVote", "call", "vote", clientConfig.getName(), "response", result);
            recordResult(x, result, clientConfig);
            callReport(x);
            return result;
            } catch (Throwable e) {
              getLogger().debug(clientConfig.getId(), "vote", e.getMessage());
              return -1L;
            }
          });
        }

          voteResults =  pool.invokeAll(voteCallables);
          for( Future<Long> voteResult : voteResults ) {
            try {
              if ( getState() == ElectoralServiceState.VOTING &&
                   ! voteResult.isDone() ) {
                voteResult.cancel(true);
              } else {
                long vote = voteResult.get(5, TimeUnit.SECONDS);
              }
            } catch(Exception e) {
              getLogger().error(e);
            }
          }
      } catch ( Exception e) {
        getLogger().error(e);
      } finally {
        getLogger().debug("callVote", "end", "votes", getVotes(), "voters", voters.size(), getState().getLabel());
      }
      `
    },
    {
      name: 'vote',
      javaCode: `
      System.out.println("vote "+ id +", "+time+", "+getElectionTime()+", "+getState().getLabel());

      getLogger().debug("vote", id, time, getElectionTime(), getState().getLabel());
      long v = -1L; 
      try {
        if ( getState() == ElectoralServiceState.ELECTION &&
            time < getElectionTime() ) {
          // abandone our election.
          getLogger().debug("vote", id, time, "abandon election");
          synchronized ( electionLock_ ) {
            setState(ElectoralServiceState.VOTING);
          }
        }
        if ( getState() == ElectoralServiceState.VOTING ) { 
          v = generateVote(getX());
        }
        getLogger().debug("vote", id, time, "response", v);
      } catch (Throwable t) {
        getLogger().error("vote", id, time, "response", v, t);
      }
      return v;
     `
    },
    {
      name: 'generateVote',
      args: [
        {
          name: 'x',
          type: 'Context'
        }
      ],
      type: 'int',
      javaCode: `
      return ThreadLocalRandom.current().nextInt(255);
     `
    },
    {
      name: 'callReport',
      args: [
        {
          name: 'x',
          type: 'Context'
        }
      ],
      javaCode: `
      ClusterConfigService service = (ClusterConfigService) getX().get("clusterConfigService");
      ClusterConfig config = service.getConfig(x, service.getConfigId());
      List voters = service.getVoters(getX());
      try {
        synchronized ( electionLock_ ) {
          if ( ! ( getState() == ElectoralServiceState.ELECTION &&
                   hasQuorum(voters.size()) ) )  {
            getLogger().debug("callReport", "no quorum", "votes", getVotes(), "voters", voters.size(), getState().getLabel());
            return;
          }
        }

        getLogger().debug("callReport", "votes", getVotes(), "voters", voters.size(), getState().getLabel());

        report(getWinner());

        ThreadPoolExecutor pool = pool_;
        List<Callable<Void>> reportCallables = new ArrayList<>();
        List<Future<Void>> reportResults = null;

              for (int j = 0; j < voters.size(); j++) {
                ClusterConfig clientConfig2 = (ClusterConfig) voters.get(j);
                if ( clientConfig2.getId().equals(config.getId())) {
                  continue;
                }

                ClientElectoralService electoralService2 =
                  new ClientElectoralService.Builder(getX())
                   .setDelegate(new HTTPBox.Builder(getX())
                     .setUrl(buildURL(clientConfig2))
                     .setAuthorizationType(foam.box.HTTPAuthorizationType.BEARER)
                     .setSessionID(clientConfig2.getSessionId())
                     .setConnectTimeout(3000)
                     .setReadTimeout(3000)
                     .build())
                   .build();
                
                reportCallables.add(() -> {
                  getLogger().debug("callReport", "call", "report", getWinner());
                  try {
                    electoralService2.report(getWinner());
                  } catch (Throwable e) {
                    getLogger().debug(clientConfig2.getId(), "report", e.getMessage());
                  }
                  return null;
                });
              }

              try {
                getLogger().debug("callReport", "invoke reportCallables");
                reportResults = pool.invokeAll(reportCallables);
                for( Future<Void> reportResult : reportResults ) {
                  try {
                    reportResult.get(5, TimeUnit.SECONDS);
                  } catch(Exception e) {
                    getLogger().error(e);
                  }
                }
              } catch ( Exception e) {
                getLogger().error(e);
              }
      } catch ( Exception e) {
        getLogger().error(e);
      }
      `
    },
    {
      name: 'report',
      javaCode: `
      ClusterConfigService service = (ClusterConfigService) getX().get("clusterConfigService");
      service.setPrimaryConfigId(winner);
      service.setIsPrimary(service.getConfigId().equals(winner));

      DAO dao = (DAO) getX().get("localClusterConfigDAO");
      List voters = service.getVoters(getX());
      for (int i = 0; i < voters.size(); i++) {
        ClusterConfig config = (ClusterConfig) ((ClusterConfig) voters.get(i)).fclone();
        if ( winner.equals(config.getId()) &&
             ! config.getIsPrimary() ) {
          // found the winner, and it is the 'new' primary, may or may not be us.
          getLogger().debug("report", winner, "new primary", config.getName());
          config.setIsPrimary(true);
          config = (ClusterConfig) dao.put_(getX(), config);
        } else if ( config.getIsPrimary() ) {
          // no longer primary
          getLogger().debug("report", winner, "old primary", config.getName());
          config.setIsPrimary(false);
          config = (ClusterConfig) dao.put_(getX(), config);
        }
      }
      synchronized ( electionLock_ ) {
        setState(ElectoralServiceState.IN_SESSION);
      }

      getLogger().debug("report", winner, getState().getLabel(), "service", service.getConfigId(), "primary", service.getPrimaryConfigId(), service.getIsPrimary());
     `
    }
  ]
});
