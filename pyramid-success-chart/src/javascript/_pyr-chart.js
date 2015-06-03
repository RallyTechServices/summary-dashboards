Ext.define('Rally.technicalservices.pyrChart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.pyrchart',

    itemId: 'rally-chart',
    chartData: {},
    loadMask: false,
    chartColors : [],
    initAnimAfterLoad: false,
    chartConfig: {
        colors : [/*"#E0E0E0",*/"#00a9e0","#8dc63f"],
        chart: {
            type: 'pyramid',
            marginRight : 100
        },
        title: {
            text: 'Success Chart'
        },
        plotOptions: {
            series: {
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b> ({point.y:,.0f})',
                    color:  'black',
                    softConnector: true
                }
            }
        },
        legend : {
            enabled : false
        }

    },
    constructor: function (config) {
        this.callParent(arguments);
        if (config.title){
            this.chartConfig.title = config.title;
        }
    }
});