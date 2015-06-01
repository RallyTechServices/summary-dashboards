Ext.define('Rally.technicalservices.bmChart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.bmchart',

    itemId: 'rally-chart',
    chartData: {},
    loadMask: false,
    chartColors : [],
    chartConfig: {
        chartColors : [],
        chart: {
            type: 'bar'
        },
        title: {
            text: 'Progress by Project'
        },
        xAxis: {
            tickInterval: 1,
            title: {
                text: '%'
            }
        },
        yAxis: [
            {
                min: 0,
                max: 100,
                title: {
                    text: '% of Scheduled Stories by State'
                }
            }
        ],
        plotOptions: {
            series: {
                dataLabels: {
                    enabled: true,
                    align: 'center',
                                   format:'{y}%',
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
    }
});