Ext.define('Rally.technicalservices.progressChart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.progresschart',

    itemId: 'rally-chart',
    chartData: {},
    loadMask: false,
    chartColors : [],
    chartConfig: {
        colors : ["#ee6c19","#FAD200","#3F86C9","#8DC63F", "#888"],
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
        legend: {
            reversed: true
        },
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