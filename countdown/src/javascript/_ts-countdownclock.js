Ext.define('Rally.technicalservices.CountDownClock',{
    extend: 'Ext.Container',
    alias: 'widget.tscountdown',
    padding: 5,
    defaults: { margin: '0 7 0 7' },
    layout: { type: 'table', columns: 4, tableAttrs:{style:{width:'100%'} } },
    cls: 'clock',
    
    config: {
        /**
         * @cfg {Date} 
         * The end date (and time) for the counter to count down to
         */
        endDate: new Date(),
        /**
         * @cfg {String}
         * A message to show on click of the whole thing
         */
        text: '',
        /**
         * @cfg String
         * A label to go above the clock
         */
        fieldLabel: ''
    },
    
    constructor: function(config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
    },

    initComponent: function() {
        this.items = this._buildItems();
        this.callParent(arguments);

        this.currentDate = new Date();
        this.on('render', this._addClickEvent, this);
        
        Ext.TaskManager.start({ run: this.updateCounters, interval: 750, scope: this } );
    },
    
    _addClickEvent: function() {
        this.mon(this.getEl(), 'click', this._showDescriptionDialog, this);
    },
    
    _showDescriptionDialog: function() {
        Ext.create('Rally.ui.dialog.Dialog',{
            title: 'Source',
            autoShow: true,
            draggable: true,
            width: this.width,
            height: this.height,
            closable: true,
            items: [{xtype:'container', html: this.text, padding: 15}]
        });
    },
    
    setEndDate: function(end_date) {
        this.endDate = end_date;
        this.updateCounters();
    },
    
    updateCounters: function() {
        var end_date = this.endDate;
        current_date = new Date();
        var diff = this.calculateDifferences(end_date, current_date);
        this.down('#days').update(diff);
        this.down('#hours').update(diff);
        this.down('#minutes').update(diff);
        this.down('#seconds').update(diff);
    },
    
    // return a hash { days: 12, 
    calculateDifferences: function(end_date, current_date){
        var diff = {
            days: this._getDifferenceAboveZero(end_date, current_date, 'day'),
            hours: this._getDifferenceAboveZero(end_date,current_date, 'hour'),
            minutes: this._getDifferenceAboveZero(end_date,current_date, 'minute'),
            seconds: this._getDifferenceAboveZero(end_date,current_date, 'second')
        }

        return diff;
    },
    
    _getDifferenceAboveZero: function(end_date,current_date,metric) {
        var diff = Rally.util.DateTime.getDifference(end_date,current_date, metric);
        diff > 0 ? diff = diff : diff = 0;
        
        metric_tops = { 'hour': 24, 'minute': 60, 'second': 60 };
        
        if ( metric_tops[metric] ) {
            diff = diff % metric_tops[metric];
        }

        return diff;
    },
    
    _buildItems: function() {
        var items = [];
        
        if ( !Ext.isEmpty(this.fieldLabel) ){
            items.push({
                xtype: 'container',
                cellCls: 'clock-label',
                html: this.fieldLabel,
                padding: '0 0 5 0',
                colspan: 4
            });
        }
        
        items.push({ 
            xtype: 'container', 
            itemId:'days',
            cellCls: 'clock-counter',
            tpl: '{days:leftPad(3,"0")}'
        });
        
        items.push({ 
            xtype: 'container', 
            itemId:'hours',
            cellCls: 'clock-counter',
            tpl: '{hours:leftPad(2,"0")}'
        });
        
        items.push({ 
            xtype: 'container', 
            itemId:'minutes',
            cellCls: 'clock-counter',
            tpl: '{minutes:leftPad(2,"0")}'
        });
        
        items.push( { 
            xtype: 'container', 
            itemId:'seconds',
            cellCls: 'clock-counter',
            tpl: '{seconds:leftPad(2,"0")}'
        });
        
        items.push({
            xtype: 'container',
            cellCls: 'clock-label',
            html: 'DAYS'
        });
        
        items.push({
            xtype: 'container',
            cellCls: 'clock-label',
            html: 'HOURS'
        });
        
        items.push({
            xtype: 'container',
            cellCls: 'clock-label',
            html: 'MINUTES'
        });
       
        
        items.push({
            xtype: 'container',
            cellCls: 'clock-label',
            html: 'SECONDS'
        });
        
        return items;
    }
});