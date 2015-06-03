Ext.define('Rally.technicalservices.ThreatChart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.tsthreatchart',

    chartData: {},

    chartConfig: {
        loadMask: false,
        chart: {
            type: 'scatter',
            zoom: 'xy'
        },
        title: {
            text: 'Threat Matrix'
        },
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
                dataLabels: {
                    formatter: function(){return this.series.name;},
                    enabled: true,
                    inside: true
                }
            }
        }

      },
    constructor: function (config) {
        this.callParent(arguments);
        if (config.title){
            this.chartConfig.title = config.title;
        }
    },
    onRender: function () {
        this.callParent(arguments);
        this.getEl().unmask();
    }
});
