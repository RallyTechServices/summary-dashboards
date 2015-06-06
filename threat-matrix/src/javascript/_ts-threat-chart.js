Ext.define('Rally.technicalservices.ThreatChart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.tsthreatchart',

    chartData: {},

    chartConfig: {
        loadMask: false,
        chart: {

            type: 'scatter',
            zoom: 'xy',
            events: {
                load: function(){
                    console.log('chart load', this);
                }
            }
        },
        title: {
            text: 'Threat Matrix'
        },
        legend: {
            enabled: false
        },
        xAxis: [{
            min: 0,
            title: {
                text: 'Feature Age (Days)'
            },
            opposite: true,
            startOnTick: true,
            endOnTick: true,
            showLastLabel: true
        },{
            title: {
                text: 'User Story Age (Days)'
            },
            min: 0,
            startOnTick: true,
            endOnTick: true,
            showLastLabel: true
        }],
        yAxis: [
            {
                max: 110,
                min: 0,
                title: {
                    text: '%Density (Feature)'
                },
                opposite: true
            },
            {
                title: {
                    text: 'Weighted Risk (User Story)'
                },
                min: 0
            }
        ],
        plotOptions: {
            series: {
                dataLabels: {
                    formatter: function(){return this.series.name;},
                    inside: true
                },
                tooltip: {
                    borderColor: 'black'
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
