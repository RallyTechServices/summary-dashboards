Ext.define('Rally.technicalservices.grid.Legend', {
    extend: 'Rally.ui.grid.Grid',
    alias: 'widget.tslegendgrid',
    config: {
        series: undefined,
        columnCfgs: [],
        showRowActionsColumn: false,
        enableBulkEdit: false,
        padding: 10
    },
    columnHidden: {},
    rowHidden: {},
    constructor: function (config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
    },
    initComponent: function () {
        var pageSize = Math.max(this.records.length, 200);
        this.store = Ext.create('Rally.data.custom.Store',{
            data: this.records,
            pageSize: pageSize
        });
        this.columnCfgs = this._getColumnCfgs();
        this.pageSize = pageSize;
        this.showPagingToolbar = pageSize > 200;

        this.addEvents('colorclicked','shapeclicked');
        this.callParent(arguments);

        this.headerCt.on('headerclick', this._onHeaderClick, this);
    },
    _onHeaderClick: function(header, col, e, t){
        if (col.shape){
            this.fireEvent('shapeclicked', col.shape);

            this.toggleColumnState(col.shape);
        }
    },
    toggleRowState: function(rowIndex) {
        var is_hidden = (this.rowHidden[rowIndex] == true),
            color = is_hidden ? "#000000" : "#c6c6c6",
            row_color = this.getStore().getAt(rowIndex).get('__color'),
            rows = this.getStore().getCount();

        for (var j=0; j<rows; j++){
            var r_color = this.getStore().getAt(j).get('__color');
            if (r_color == row_color){
                for (var i=0; i< this.columns.length; i++){
                    if (this.columnHidden[this.columns[i].dataIndex] != true){
                        var cell = this.getView().getCell(j,this.columns[i]);
                        if (cell) {
                            Ext.fly(cell).setStyle("color",color);
                        }
                    }
                }
                this.rowHidden[j] = !is_hidden;
            }
        }
    },

    toggleColumnState: function(shape){

        var rows = this.getStore().getCount();

        var cols = [];
        _.each(this.columns, function(col){
            if (col.shape == shape){
                cols.push(col);
            }
        });

        for (var j=0; j<cols.length; j++){
            var is_hidden = (this.columnHidden[cols[j].dataIndex] == true),
                color = is_hidden ? "#000000" : "#c6c6c6";

            for (var i=0; i< rows; i++){
                if (this.rowHidden[i] != true){
                    var cell = this.getView().getCell(i,cols[j]);
                    if (cell) {
                        Ext.fly(cell).setStyle("color",color);
                    }
                }
            }
            this.columnHidden[cols[j].dataIndex] = !is_hidden;
        }
    },
    _getColumnCfgs: function(){
        var me = this;

        return [{
            xtype:'actioncolumn',
            dataIndex: '__color',
            width: 24,
            handler: function(grid, rowIndex, colIndex, item) {
                var rec = grid.getStore().getAt(rowIndex);
                if (rec.get('__colorHidden')){
                    rec.set('__colorHidden',false);
                } else {
                    rec.set('__colorHidden',true);
                }
                me.toggleRowState(rowIndex, rec.get('__colorHidden') );
                me.fireEvent('colorclicked', rec);
            },
            renderer: function(v, m, r){
                m.style = "background-color:" + r.get('__color');
                m.tdCls = "grid-legend-show-action"
            }
        },{
            dataIndex: 'Project',
            text: 'Project',
            flex: 3,
            renderer: this._projectNameRenderer
        },{
            dataIndex: 'Name',
            flex: 2,
            text: 'Iteration'
        },{
            dataIndex:'StartDate',
            text:'Start',
            flex: 2,
            renderer: this._dateRenderer
        },{
            dataIndex:'EndDate',
            text:'End',
            flex: 2,
            renderer: this._dateRenderer
        },{
            dataIndex:'PlannedVelocity',
            text:'&#9724;&nbsp;&nbsp;Potential (Planned)',
            flex: 1,
            //editor: 'rallynumberfield',
            sortable: false,
            shape: 'square'
        },{
            dataIndex:'__startScope',
            flex: 1,
            text:'&#9675;&nbsp;&nbsp;Points at Start (Stability)',
            sortable: false,
            shape: 'circle'
        },{
            dataIndex:'__endScope',
            flex: 1,
            text:'&#9679;&nbsp;&nbsp;Points at End (Stability)',
            sortable: false,
            shape: 'circle'
        },{
            dataIndex:'__endAcceptance',
            flex: 1,
            text:'&#9660;&nbsp;&nbsp;Accepted at End',
            sortable: false,
            shape: 'triangle-down'
        }];
     },
    _dateRenderer: function(value){
        //todo make ordinals
        return Ext.util.Format.date(value,'Y-m-d');
    },
    
    _projectNameRenderer: function(value) {
        if ( !Ext.isEmpty(value) ) {
            var name_array = value.Name.split('>');
            return name_array[name_array.length - 1];
        }
        
        return value;
    },
    
    _objectNameRenderer: function(value){
        if (value && value.Name){
            return value.Name;
        }
        return value;
    }
});