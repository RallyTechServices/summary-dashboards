Ext.define('Rally.technicalservices.wipChart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.wipchart',

    itemId: 'rally-chart',
    chartData: {},
    loadMask: false,
    chartColors : [],
    chartConfig: {
        colors : [/*"#E0E0E0",*/"#00a9e0","#8dc63f"],
        chart: {
            type: 'bar'
        },
        title: {
            text: 'WIP Limits Chart'
        },
        xAxis: {
        },        
        yAxis: [
            {
                title: {
                    text: 'Under / Over WIP Limits'
                }
            }
        ],
        plotOptions: {
            series: {
                dataLabels: {
                    enabled: true,
                    color: '#FFFFFF'
                },
                stacking: 'normal'
            }        
        }
    },
    constructor: function (config) {
        this.callParent(arguments);
        if (config.title){
            this.chartConfig.title = config.title;
        }
        if (!_.isUndefined(config.stacking)) {
            this.chartConfig.plotOptions.series.stacking = (config.stacking===true ? 'normal' : null);
        }
    }
});