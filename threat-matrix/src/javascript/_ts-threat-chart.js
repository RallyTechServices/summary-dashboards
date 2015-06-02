Ext.define('Rally.technicalservices.ThreatChart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.tsthreatchart',

    chartData: {},
    loadMask: false,
    chartConfig: {
        chart: {
            type: 'scatter',
            zoom: 'xy'
        },
        title: {
            text: 'Threat Matrix'
        },
        loadMask: false,
        legend: {
            enabled: false
        },
        xAxis: {
            min: 0,
            title: {
                text: 'Age (days)'
            },
            startOnTick: true,
            endOnTick: true,
            showLastLabel: true
        },
        yAxis: [
            {
                title: {
                    text: '%Density'
                }
            }
        ],
        plotOptions: {
            series: {
                type: "scatter",
                tooltip: {
                    pointFormat: ''
                }
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
