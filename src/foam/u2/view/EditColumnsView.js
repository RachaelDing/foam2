/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.u2.view',
  name: 'ColumnConfig',
  sections: [{ name: '_defaultSection' }],
  properties: [
    {
      class: 'Class',
      name: 'of',
      hidden: true
    },
    {
      name: 'axiom',
      hidden: true
    },
    {
      class: 'String',
      name: 'label',
      label: '',
      visibility: 'RO',
      expression: function(of, axiom) {
        return axiom.label || foam.String.labelize(axiom.name);
      },
      gridColumns: 6
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.view',
  name: 'EditColumnsView',
  extends: 'foam.u2.View',// it will imports 'data'

  requires: [
    'foam.u2.DetailView',
    'foam.u2.view.ColumnsConfigView'
  ],
  properties: [
    {
      class: 'Class',
      name: 'of',
      hidden: true
    },
    // {
    //   class: 'FObjectArray',
    //   of: 'foam.u2.view.ColumnConfig',
    //   name: 'columns',
    //   view: {
    //     class: 'foam.u2.view.ColumnConfigView',
    //     allColumns$: this.allColumns$
    //   },
    //   factory: function() {
    //     var rtn = JSON.parse(localStorage.getItem(this.of.id))
    //     if ( !rtn ) {
    //       rtn = this.allColumns.map(([axiomName, overridesMap]) => {//what is overridesMap??? can't find
    //         const axiom = this.of.getAxiomByName(axiomName);
    //         if ( overridesMap ) axiom = axiom.clone().copyFrom(overridesMap);
    //         return this.ColumnConfig.create({ of: this.of, axiom: axiom });
    //       });
    //     } else {
    //       rtn = this.allColumns.map((axiomName) => {//what is overridesMap??? can't find
    //         const axiom = this.of.getAxiomByName(axiomName);
    //         return this.ColumnConfig.create({ of: this.of, axiom: axiom });
    //       });
    //     }
        

    //     // Sort columns alphabetically. This doesn't quite work since what we
    //     // actually display is up to tableHeaderFormatter, which works directly
    //     // with the view instead of returning a String, so there's no way for
    //     // us to actually know what the user is going to see.
    //     rtn.sort((l, r) => l.label < r.label ? -1 : 1);

    //     return rtn;
    //   }
    // },
    {
      class: 'Array',
      name: 'allColumns',
      hidden: true,
      // view: {
      //   class: 'foam.u2.view.ColumnsConfigView',
      //   allColumns$: this.allColumns$
      // }
    },
    'selectedColumns'
  ],
  // This shouldn't be needed.
  imports: [
    'stack'
  ],
  actions: [
    {
      name: 'cancel',
      code: function() {
        this.stack.back();
      },
      view: function() {
        return {
          class: 'foam.u2.ActionView',
          action: this,
          buttonStyle: 'SECONDARY'
        };
      }
    },
    {
      name: 'resetAll',
      code: function() {//fix to tableColumns
        this.columns.forEach(c => c.visibility = 'DEFAULT');
      },
      confirmationRequired: true
    },
    {
      name: 'save',
      code: function() {
        localStorage.removeItem(this.of.id);
        localStorage.setItem(this.of.id, JSON.stringify(this.columns.map(c => foam.core.StringArray.isInstance(c) ? c[0] : c)));
        this.stack.back();
      }
    }
  ],
  methods: [
    function initE() {
      this.add(this.ColumnsConfigView.create({of:this.of, allColumns:this.allColumns, selectedColumns$:this.selectedColumns$}))//;//this.DetailView.create({ data: this });
      .startContext({ data: this })
        .add(this.CANCEL)
        .add(this.SAVE)
      .endContext();
    }
  ]
});
