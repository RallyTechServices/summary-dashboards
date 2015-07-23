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
    stateHidden: {},
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

        var colorHidden = this.stateHidden[color] === true;

        _.each(this.getChart().series, function(s){
            if (s && s.color == color){
                var shapeHidden = this.stateHidden[s.symbol] == true;
                if (colorHidden === true){
                    if (shapeHidden != true){
                        s.show();
                    }
                } else {
                    s.hide();
                }
                this.stateHidden[color] = !colorHidden;
            }
        }, this);
    },
    toggleShape: function(shape){
        var shapeHidden = this.stateHidden[shape] === true;
        _.each(this.getChart().series, function(s){
            if (s && s.symbol == shape){
                var colorHidden = this.stateHidden[s.color] == true;
                if (shapeHidden === true){
                    if (colorHidden != true){
                        s.show();
                    }
                } else {
                    s.hide();
                }
                this.stateHidden[shape] = !shapeHidden;
            }
        }, this);
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

            r.set('__seriesColor', colors[color_index]);
            r.set('__color', colors[color_index]);

            color_index++;
        }, this);

        this.chartConfig.xAxis.categories = categories;
        this.chartData.series = series;
        this.chartData.categories = categories;

        this.fireEvent('legendupdated', series);
    },

    _padArray: function(array, desired_length,padding_value){
        var new_array = Ext.clone(array);
        padding_value = padding_value || null;
        while (new_array.length < desired_length){
            new_array.push(padding_value);
        }
        return new_array;
    },
    _initReleaseChart: function(){

        var series = [],
            colors = this.chartConfig.colors,
            color_index = 0,
            project_hash = {},
            sorted_records = _.sortBy(this.records, function(r){
                return r.get('StartDate');
            }),
            iterations = [];

        _.each(sorted_records, function(r) {
            var project_oid = r.get('Project').ObjectID,
                iteration_name = r.get('Name');

            if (!Ext.Array.contains(iterations, iteration_name)){
                iterations.push(iteration_name);
            }

            if (project_hash[project_oid] == undefined) {
                project_hash[project_oid] = {};
            }
            project_hash[project_oid][iteration_name] = r;
        });

        _.each(project_hash, function(obj, project_oid){

            var start_scope_data = _.map(iterations, function(i){return obj[i] ? obj[i].get('__startScope') || null : null;}),
                end_scope_data = _.map(iterations, function(i){return obj[i] ? obj[i].get('__endScope') || null : null;}),
                end_acceptance_data = _.map(iterations, function(i){return obj[i] ? obj[i].get('__endAcceptance') || null : null;}),
                planned_velocity = _.map(iterations, function(i){return obj[i] ? obj[i].get('PlannedVelocity') || null : null;});

            series.push({
                name: "End Acceptance", //obj[0].getField('__endAcceptance').displayName,
                data: end_acceptance_data,
                color: colors[color_index],
                marker: { symbol:'triangle-down'}
            });

            series.push({
                name: "End Stability", //obj.getField('__endScope').displayName,
                data: end_scope_data,
                color: colors[color_index],
                marker: { symbol:'circle'}
            });

            series.push({
                name: "Start Stability", //obj.getField('__startScope').displayName,
                data: start_scope_data,
                color: colors[color_index],
                marker: { symbol:'circle' , fillColor: '#FFFFFF', lineColor: colors[color_index], lineWidth: 2}
            });

            series.push({
                name: "Potential", //obj.getField('PlannedVelocity').displayName,
                data: planned_velocity,
                color: colors[color_index],
                marker: { symbol:'square'}
            });

            //Now set the colors in the records
            _.each(obj, function(r, i){
                r.set('__seriesColor', colors[color_index]);
                r.set('__color', colors[color_index]);
            });
            color_index++;
        });

        this.chartConfig.xAxis.categories = iterations;
        this.chartData.series = series;
        this.chartData.categories = iterations;
        this.chartConfig.xAxis.title.text = "Iteration";

        this.fireEvent('legendupdated', series);
    },
    //Overriding this function because we want to set colors ourselves.
    _setChartColorsOnSeries: function (series) {
        return null;
    }
});
