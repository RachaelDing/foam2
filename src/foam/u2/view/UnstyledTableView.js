/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view',
  name: 'UnstyledTableView',
  extends: 'foam.u2.Element',

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.u2.md.OverlayDropdown',
    'foam.u2.view.EditColumnsView'
  ],

  exports: [
    'columns',
    'selection',
    'hoverSelection'
  ],

  imports: [
    'dblclick?',
    'editRecord?',
    'selection? as importSelection'
  ],

  properties: [
    {
      class: 'Class',
      name: 'of'
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'data',
      postSet: function(_, data) {
        if ( ! this.of && data ) this.of = data.of;
      }
    },
    {
      class: 'foam.dao.DAOProperty',
      name: 'orderedDAO',
      expression: function(data, order) {
        return data ? data.orderBy(order) : foam.dao.NullDAO.create();
      }
    },
    {
      name: 'order'
    },
    {
      name: 'columns_',
      expression: function(columns, of) {
        var of = this.of;
        if ( ! of ) return [];

        return columns.map(function(p) {
          var c = typeof p == 'string' ?
            of.getAxiomByName(p) :
            p;

           if ( ! c ) {
             console.error('Unknown table column: ', p);
           }

          return c;
        }).filter(function(c) { return c; });
      }
    },
    {
      name: 'columns',
      expression: function(of) {
        var of = this.of;
        if ( ! of ) return [];

        var tableColumns = of.getAxiomByName('tableColumns');

        if ( tableColumns ) return tableColumns.columns;

        return of.getAxiomsByClass(foam.core.Property).
            filter(function(p) { return p.tableCellFormatter && ! p.hidden; }).
            map(foam.core.Property.NAME.f);
      }
    },
    {
      class: 'Boolean',
      name: 'editColumnsEnabled',
      value: true,
      documentation: 'Set this to true to let the user select columns.'
    },
    {
      class: 'Boolean',
      name: 'disableUserSelection',
      value: false,
      documentation: 'Ignores selection by user.'
    },
    {
      name: 'ascIcon',
      documentation: 'HTML entity representing unicode Up-Pointing Triangle',
      factory: function() {
        return this.Entity.create({ name: '#9650' });
      }
    },
    {
      name: 'descIcon',
      documentation: 'HTML entity representing unicode Down-Pointing Triangle',
      factory: function() {
        return this.Entity.create({ name: '#9660' });
      }
    },
    {
      name: 'vertMenuIcon',
      documentation: 'HTML entity representing unicode Vertical Ellipsis',
      factory: function() {
        return this.Entity.create({ name: '#8942' });
      }
    },
    {
      name: 'selection',
      expression: function(importSelection) { return importSelection || null; },
    },
    'hoverSelection',
    'dropdownOrigin',
    'overlayOrigin'
  ],

  methods: [
    function sortBy(column) {
      this.order = this.order === column ?
        this.DESC(column) :
        column;
    },

    function createColumnSelection() {
      var editor = this.EditColumnsView.create({
        columns: this.columns,
        columns_$: this.columns_$,
        table: this.of
      });

      return this.OverlayDropdown.create().add(editor);
    },

    /** Adds offset for edit columns overlay dropdown
     * OverlayDropdown adds element to top right of parent container.
     * We want the table dropdown to appear below the dropdown icon.
     */
    function positionOverlayDropdown(overlay) {
      // Dynamic position calculation
      var origin  = this.dropdownOrigin.el();
      var current = this.overlayOrigin.el();

      var boundingBox = origin.getBoundingClientRect();
      var dropdownMenu = current.getBoundingClientRect();

      overlay.style({ top: boundingBox.top - dropdownMenu.top + 'px' });
    },

    function initE() {
      var view = this;
      var columnSelectionE;

      this.start('div', null, this.overlayOrigin$)
        .callIf(view.editColumnsEnabled, function() {
          columnSelectionE = view.createColumnSelection();
          this.add(columnSelectionE);
        })
      .end();

      this.
        addClass(this.myClass()).
        addClass(this.myClass(this.of.id.replace(/\./g, '-'))).
        setNodeName('table').
        start('thead').
          add(this.slot(function(columns_) {
            return this.E('tr').
              forEach(columns_, function(column) {
                this.start('th').
                  addClass(view.myClass('th-' + column.name)).
                  callIf(column.tableWidth, function() {
                    this.style({ width: column.tableWidth });
                  }).
                  on('click', function(e) { view.sortBy(column); }).
                  call(column.tableHeaderFormatter, [column]).
                  add(' ', this.slot(function(order) {
                    return column === order ? view.ascIcon :
                        (view.Desc.isInstance(order) && order.arg1 === column) ? view.descIcon : ''
                  }, view.order$)).
                end();
              }).
              call(function() {
                this.start('th').
                  callIf(view.editColumnsEnabled, function() {
                    this.addClass(view.myClass('th-editColumns')).
                    on('click', function(e) {
                      view.positionOverlayDropdown(columnSelectionE);
                      columnSelectionE.open();
                    }).
                    add(' ', view.vertMenuIcon).
                    addClass(view.myClass('vertDots')).
                    addClass(view.myClass('noselect'));
                  }).
                  tag('div', null, view.dropdownOrigin$).
                end();
              });
          })).
          add(this.slot(function(columns_) {
            return this.
              E('tbody').
              select(this.orderedDAO$proxy, function(obj) {
                return this.E('tr').
                  on('mouseover', function() { view.hoverSelection = obj; }).
                  callIf(view.dblclick && ! view.disableUserSelection, function() {
                    this.on('dblclick', function() {
                      view.dblclick && view.dblclick(obj);
                    });
                  }).
                  callIf( ! view.disableUserSelection, function() {
                    this.on('click', function() {
                      view.selection = obj;
                      if ( view.importSelection$ ) view.importSelection = obj;
                      if ( view.editRecord$ ) view.editRecord(obj);
                    });
                  }).
                  addClass(view.slot(function(selection) {
                    return selection && foam.util.equals(obj.id, selection.id) ?
                        view.myClass('selected') : '';
                  })).
                  addClass(view.myClass('row')).
                  forEach(columns_, function(column) {
                    this.
                      start('td').
                        callOn(column.tableCellFormatter, 'format', [
                          column.f ? column.f(obj) : null, obj, column
                        ]).
                      end();
                  }).
                  call(function() {
                    var model = view.of;
                    var actions = model.getAxiomsByClass(foam.core.Action);
                    var overlay = view.OverlayDropdown.create();
                    var availableActions = actions.filter(function(action) {
                      return action.isAvailableFor(obj);
                    });

                    // Don't show the context menu if there are no available
                    // actions defined on the model.
                    if ( availableActions.length === 0 ) {
                      if ( view.editColumnsEnabled ) {
                        return this.tag('td');
                      }
                      return;
                    }

                    overlay.forEach(availableActions, function(action) {
                      var elm = this.start()
                        .addClass(view.myClass('context-menu-item'))
                        .add(action.label);

                      if ( action.isEnabledFor(obj) ) {
                        elm = elm.on('click', function(evt) {
                          action.maybeCall(view.__subContext__, obj);
                        });
                      } else {
                        elm.addClass('disabled');
                      }

                      elm.end();
                    });

                    return this.start('td').
                      add(overlay).
                      style({ 'text-align': 'right' }).
                      on('click', function(e) {
                        e.stopImmediatePropagation();
                        view.positionOverlayDropdown(overlay);
                        overlay.open();
                      }).
                      start('span').
                        addClass(view.myClass('vertDots')).
                        addClass(view.myClass('noselect')).
                        add(view.vertMenuIcon).
                      end().
                    end();
                  });
              });
          }));
    }
  ]
});
