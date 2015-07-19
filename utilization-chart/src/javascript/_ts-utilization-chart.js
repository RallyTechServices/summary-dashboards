Ext.define('Rally.technicalservices.chart.Utilization',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.tsutilizationchart',

    /**
     * __startScope
     * __endScope
     * __days
     * __endAcceptance
     * __dailyScope
     * __dailyAcceptance
     * Name
     * Project
     * StartDate
     * EndDate
     * PlannedVelocity
     *
     * For each project, graphs:
     *   __dailyScope
     *   __dailyAcceptance
     *
     */
    config: {

        loadMask: false,

        chartData: {
            series: []
        },
        chartConfig: {

            colors: [ '#2f7ed8', '#8bbc21', '#910000',
            '#492970', '#f28f43', '#145499','#77a1e5', '#c42525', '#a6c96a',
            '#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9','#aa1925',
            '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1','#1aadce',
            '#4572A7', '#AA4643', '#89A54E', '#80699B', '#3D96AE',
            '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92'],

            chart: {
                height: 300
            },
            title: {
                text: '',
                align: 'center'
            },
            legend: {
                enabled: false
            },
            xAxis: {
                categories:  [],
                title: { text: 'Days' }
            },
            yAxis: [{
                title: { text: 'Points' },
                min: 0
            }],
            plotOptions: {}
        },

        records: undefined,

        zoomToIteration: true

    },
    constructor: function(config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
    },
    initComponent: function() {
        this.addEvents('legendupdated');
        this.callParent(arguments);

        if (this.zoomToIteration){
            this._initIterationChart();
        } else {
            this._initReleaseChart();
        }
    },
    toggleColor: function(color){
        _.each(this.getChart().series, function(s){
            if (s && s.color == color){
                if (s.visible){
                    s.hide();
                } else {
                    s.show();
                }
            }
        });
    },
    toggleShape: function(shape){
        _.each(this.getChart().series, function(s){
            if (s && s.marker.symbol == shape){
                if (s.visible){
                    s.hide();
                } else {
                    s.show();
                }
            }
        });
    },
    _initIterationChart: function(){

        var categories = _.map(this.records[0].get('__days'), function(d){
            return Rally.util.DateTime.format(d, 'M-d')
        });

        var series = [],
            colors = this.chartConfig.colors,
            color_index = 0;

        _.each(this.records, function(r){
            series.push({
                name: r.getField('__dailyAcceptance').displayName,
                data: this._padArray(r.get('__dailyAcceptance'), categories.length),
                color: colors[color_index],
                marker: { symbol:'triangle-down'}
            });

            series.push({
                name: r.getField('__dailyScope').displayName,
                data: this._padArray(r.get('__dailyScope'), categories.length),
                color: colors[color_index],
                marker: { symbol:'circle'}
            });

            series.push({
                name: r.getField('PlannedVelocity').displayName,
                data: this._padArray([], categories.length, r.get('PlannedVelocity')),
                color: colors[color_index],
                marker: { symbol:'square'}
            });


            r.set('__color', colors[color_index]);
            color_index++;
        }, this);

        this.chartConfig.xAxis.categories = categories;
        this.chartData.series = series;
        this.chartData.categories = categories;

        this.fireEvent('legendupdated', series);

        console.log(this.chartConfig.xAxis.categories, this.chartData);
    },

    _padArray: function(array, desired_length,padding_value){
        var new_array = Ext.clone(array);
        padding_value = padding_value || null;
        while (new_array.length < desired_length){
            new_array.push(padding_value);
        }
        return new_array;
    },
    _initReleaseChart: function(){},
    //Overriding this function because we want to set colors ourselves.
    _setChartColorsOnSeries: function (series) {
        return null;
    }
});
