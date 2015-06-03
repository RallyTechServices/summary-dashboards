/*
 * For pie inside of pie --
 * 
 * Give an array of records for the inside ring and an array for the outside,
 * they should have a link via some field in the outer_ring record (e.g., Parent or WorkProduct
 * 
 * 
 */Ext.define('Rally.technicalservices.DoughnutPie',{
    extend: 'Ext.Container',
    alias: 'widget.tsdoughnut',
    padding: 5,
    
    config: {
        /**
         * @cfg [{Ext.data.Model}] 
         * Records that will each have a slice of the inside pie
         */
        inside_records: [],
        /**
         * @cfg {String} 
         * Field on the inside records that holds the size of the slice
         */
        inside_size_field: 'PlanEstimate',
        /**
         * @cfg [{Ext.data.Model}] 
         * Records that will each have a slice of the outside pie
         */
        outside_records: [],
        /**
         * @cfg {String} 
         * Field on the outside records that holds the size of the slice
         */
        outside_size_field: 'Estimate',
        /**
         * @cfg {String} 
         * Field on the outside records links to the inside record
         */
        record_link_field: 'WorkProduct',
        /**
         * @cfg {String}
         * The title to put on the chart
         */
        title: '',
        /**
         * @cfg {Number}
         * Colors to be applied in order (must be HSLA)
         * We'll take them and put them into the first part of:
         * 'hsla(235,100%,75%,1)'
         * where 25 is the color, 100% is the saturation, 75% is the lightness (100% is white), 1 is the opacity
         * 
         * NICE SITE: http://hslpicker.com/
         * 
         */
        colors: [235, 20, 126, 180, 50, 84 ]
        /**
         * 
         */
        
    },
    
    constructor: function(config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
    },

    initComponent: function() {
        this.data = this.calculateSlices();
        this.items = this._buildItems(this.data);
        this.callParent(arguments);
    },
    
    calculateSlices: function() {
        var inside_series_data = [];
        var inside_series_by_id = {};
        
        var outside_series_data = [];
        
        // make an array of hash items for the stories
        // and a tracking array so we can see if there
        // are tasks that have a story not in the list
        Ext.Array.each(this.inside_records, function(record,idx) {
            var color_index = this._getColorIndex(idx);
            
            var data_point = {
                name: record.get('FormattedID'),
                y: record.get(this.inside_size_field),
                color: 'hsla(' + this.colors[color_index] + ',100%,40%,1)',
                idx: color_index
            };
            
                                
            if ( record.get('Blocked') ) {
                data_point.color = 'red';
            }
                    
            inside_series_by_id[record.get('FormattedID')] = Ext.clone(data_point);
            inside_series_data.push(data_point);
        },this);
        
        // find any outer rings that have a parent not in the
        // inner list already.  Along the way, add the 
        // child to an array on the parent so we can use it
        // later to find the percentage.
        Ext.Array.each(this.outside_records, function(record) {
            var parent = record.get(this.record_link_field);
            if ( !parent ) {
                console.log("No parent for ", record.get('FormattedID'));
            } else {
                var parent_id = parent.FormattedID;
                var parent_size = parent[this.inside_size_field];
                
                var parent_data = inside_series_by_id[parent_id];
                if ( parent_data ) {
                    if ( ! parent_data.children ) { parent_data.children = []; }
                    parent_data.children.push(record);
                }
            }
        },this);
        
        // make child data series
        Ext.Object.each(inside_series_by_id, function(id,inside_item){            
            var children = inside_item.children || [];
            var parent_size = inside_item.y || 0;
            var parent_index = inside_item.idx || 0;
            
            if ( parent_size > 0 ) {
                var child_total = 0;
                Ext.Array.each(children,function(child){
                    var size = child.get(this.outside_size_field) || 0;
                    child_total += size;
                },this);
                
                Ext.Array.each(children, function(child) {
                    
                    var size = child.get(this.outside_size_field) || 0;
                    if ( child_total > 0 ) {
                        size =  ( size / child_total ) * parent_size;
                    }

                    var data_point = { 
                        name: child.get("FormattedID"),
                        y:size,
                        color: 'hsla(' + this.colors[parent_index] + ',100%,40%,1)'
                    };
                    
                    var inner_state_lightness = {
                        "Defined": "40%",
                        "In-Progress": "60%",
                        "Completed": "80%"
                    };
                    
                    var state = child.get('State');
                    if ( state ) {
                        data_point.color = 'hsla(' + this.colors[parent_index] + ',100%,' + inner_state_lightness[state] + ',1)';
                    }
                    
                    if ( child.get('Blocked') ) {
                        data_point.color = 'red';
                    }
                    
                    outside_series_data.push(data_point);
                },this);
                
                if ( ! children || children.length == 0 ) {
                    outside_series_data.push({ 
                        name: 'none',
                        y:parent_size,
                        color: 'white'
                    });
                }
            }
            
        },this);
                
        return [inside_series_data, outside_series_data];
    },
    
    _getColorIndex: function(idx) {
        if ( idx < this.colors.length ) {
            return idx;
        }
        return idx % this.colors.length;
     },
     
    _buildItems: function(series_data) {
        var items = [];
        
        var series = [{
            name: 'Stories',
            data: series_data[0],
            size: '65%',
            dataLabels: {
//                formatter: function () {
//                    return this.y > 5 ? this.point.name : null;
//                },
                color: 'white',
                distance: -30
            }
        },
        {
            name: 'Tasks',
            data: series_data[1],
            size: '80%',
            innerSize: '65%',
            dataLabels: {
                distance: 5,
                formatter: function () {
                    return this.point.name !== 'none' ? this.point.name : null;
                }
            }
        }];
        
        items.push({
            xtype:'rallychart',
            chartData: {
                series: series
            },
            chartConfig: {
                chart: { type: 'pie' },
                title: {
                    text: this.title,
                    align: 'center'
                },
               
                plotOptions: {
                    pie: {
                        shadow: false,
                        center: ['50%', '50%']
                    }
                }
            }
        });

        
        return items;
    }
});