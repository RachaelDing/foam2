package foam.nanos.ruler.cron;

import foam.core.ContextAgent;
import foam.core.Detachable;
import foam.core.FObject;
import foam.core.X;
import foam.dao.AbstractSink;
import foam.dao.DAO;
import foam.nanos.ruler.Rule;
import foam.nanos.ruler.RuleEngine;
import foam.nanos.ruler.RuleHistory;

import java.util.Arrays;
import java.util.Date;

import static foam.mlang.MLang.*;

public class RenewRuleHistoryCron implements ContextAgent {
  @Override
  public void execute(X x) {
    DAO ruleDAO = (DAO) x.get("ruleDAO");
    DAO ruleHistoryDAO = (DAO) x.get("ruleHistoryDAO");

    ruleHistoryDAO.where(
      AND(
        LTE(RuleHistory.EXPIRATION_DATE, new Date()),
        EQ(RuleHistory.WAS_RENEW, false)
      )
    ).select(new AbstractSink() {
      @Override
      public void put(Object obj, Detachable sub) {
        RuleHistory ruleHistory = (RuleHistory) ((FObject) obj).fclone();
        ruleHistory.setWasRenew(true);
        ruleHistoryDAO.put(ruleHistory);

        // re-execute the rule
        Rule rule = (Rule) ruleDAO.find(ruleHistory.getRuleId());
        DAO delegate = (DAO) x.get(ruleHistory.getObjectDaoKey());
        FObject object = delegate.find(ruleHistory.getObjectId());
        new RuleEngine(x, delegate).execute(
          Arrays.asList(rule), object, object);
      }
    });
  }
}
