Ext.define('Rally.technicalservices.progressChart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.progresschart',

    itemId: 'rally-chart',
    chartData: {},
    loadMask: false,
    chartColors : [],
    chartConfig: {
        colors : ["#E0E0E0","#00a9e0","#fad200","#8dc63f"],
        chart: {
            type: 'bar'
        },
        title: {
            text: 'Progress by Project'
        },
        xAxis: {
            tickInterval: 1,
            title: {
                text: ''
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
                    formatter : function() {
                        return (this.percentage !== 0) ? (Math.round(this.percentage) + " %") : "";
                    },
                    color: '#FFFFFF'
                },
                stacking: 'percent'
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