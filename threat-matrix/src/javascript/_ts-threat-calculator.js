Ext.define('Rally.technicalservices.ThreatCalculator', {
    logger: new Rally.technicalservices.Logger(),

    chartColors: [ '#2f7ed8', '#8bbc21', '#910000',
        '#492970', '#f28f43', '#145499','#77a1e5', '#c42525', '#a6c96a',
        '#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9','#aa1925',
        '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1','#1aadce',
        '#4572A7', '#AA4643', '#89A54E', '#80699B', '#3D96AE',
        '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92'],

    config: {
        riskField: undefined,
        currentProjectRef: undefined,
        projects: undefined,
        maxAgeThreshhold: undefined,
        minAgeThreshhold: undefined,
        minPointsThreshhold: undefined,
        storySizeMultiplier: 1,
        andMinThreshholds: true
    },
    /**
     * projectTree is used to show the hierarchy of the projects so that we can
     * determine which items to show (vs. which to include in the calculations)
     */
    projectTree: {},

    defaultColor: '#C0C0C0',
    colorMap: {},

    /**
     *     Symbol for anything not in the symbol map;
     *     I'm intentionally keeping features out of the symbol map and
     *     making the symbol the default since names can change.  If we
     *     add tasks to this chart, then we will add the tAsk object to
     *     the SymbolMap
     */
    defaultSymbol: "square",
    symbolMap: {
        hierarchicalrequirement: "circle"
    },
    sizeMultiplierMap: {
        hierarchicalrequirement: 2
    },
    constructor: function (config) {
        this.mergeConfig(config);
        this.projectTree = this._getTreeArray(config.projects, config.currentProjectRef);
        this.colorMap = this._buildColorMap(this.projectTree);
    },

    runCalculation: function(features, stories){

        var featureStoryHash = {},
            series = [],
            promises = [];

        _.each(stories, function(s){

            s.set('riskCount', this._getRiskScore(s));
            s.set('totalCount', 1);
            s.set('size', s.get('PlanEstimate') );
            s.set('density', this._getRiskScore(s) * 100);
            s.set('age', this._getAge(s, 'InProgressDate', this.maxAgeThreshhold));
            if (s.get('Feature')){
                featureStoryHash[s.get('Feature')._ref] = featureStoryHash[s.get('Feature')._ref] || [];
                featureStoryHash[s.get('Feature')._ref].push(s);
            }
            if (this._includeInChart(s)){
                //promises.push(this._getPredecessors(artifact));
                series.push(this._getSeries(s));
            }
        }, this);

        _.each(features, function(f){
            var riskCount = 0, totalCount = 0;
            f.set('age', this._getAge(f, 'ActualStartDate', this.maxAgeThreshhold));
            _.each(featureStoryHash[f.get('_ref')], function(s){
                totalCount ++;
                riskCount+= s.get('riskCount');
            }, this);
            f.set('riskCount', riskCount);
            f.set('totalCount', totalCount);
            f.set('size', f.get('LeafStoryPlanEstimateTotal'));
            if (f.get(this.riskField)){
                f.set('density', 100);
            } else if (totalCount > 0){
                f.set('density', riskCount/totalCount * 100);
            } else {
                f.set('density', 0);
            }
            if (this._includeInChart(f)){
                //promises.push(this._getPredecessors(artifact));
                series.unshift(this._getSeries(f));
            }
        }, this);

        //Deft.Promise.all(promises).then({
        //    scope: this,
        //    success: function(){
        //        var artifacts = stories.concat(features);
        //        var series = (artifacts, function(a){
        //            if (this._includeInChart(a)){
        //                series.push(this._getSeries(a));
        //            }
        //        }, this);
        //    },
        //    failure: function(operation){
        //
        //    }
        //});

        return {series: series};
    },
    _getPredecessors: function(artifact){
        var deferred = Ext.create('Deft.Deferred');

        if (artifact.get('Predecessors') && artifact.get('Predecessors').Count > 0 ){
            var predStore = artifact.getCollection('Predecessors');
            predStore.load({
                scope: this,
                fetch: ['ObjectID'],
                callback: function(records, operation, success){
                    var predecessorOids = [];
                    if (success) {
                        _.each(records, function(r){
                            predecessorOids.push(r.get('ObjectID'));
                        });
                        artifact.set('predecessorOids', predecessorOids);
                        deferred.resolve();
                    } else {
                        deferred.resolve(operation);
                    }
                }
            });
        }
        return deferred;
    },
    _includeInChart: function(artifact) {
        //Check project scope
        var projectRef = artifact.get('Project')._ref;

        var include = this.projectTree.get('_ref') == projectRef;
        if (!include) {
            _.each(this.projectTree.get('Children'), function (child) {
                if (child.get('_ref') == projectRef) {
                    include = true;
                    return false; //kick us out of the _.each link
                }
            }, this);
        }

        if (!include) { //Don't go any further
            return false;
        }

        var size = artifact.get('size'),
            age = artifact.get('age');

        if (this.andMinThreshholds && (size < this.minPointsThreshhold) && (age < this.minAgeThreshhold)) {
            return false;
        }
        return (size >= this.minPointsThreshhold) || (age >= this.minAgeThreshhold);

    },
    _buildColorMap: function(projectTree){
        var colorMap = {},
            i=0;

        //We only need to do this for the current and child projects since we are only looking at one
        //level of hierarchy at a time.
        colorMap[projectTree.get('_ref')] = this.chartColors[i++];
        _.each(projectTree.get('Children'), function(child){
            colorMap[child.get('_ref')] = this.chartColors[i++];
        }, this);
        return colorMap;
    },
    _getSeries: function(artifact){
        this.logger.log('id, size, age, density',artifact.get('FormattedID'),artifact.get('size'),artifact.get('age'), artifact.get('density'))

        var pointName = Ext.String.format("{0}<br/>Project: {1}<br/>Size: {2}<br/>Age (days): {3}", artifact.get('FormattedID'),
                            artifact.get('Project').Name,
                            artifact.get('size'), artifact.get('age').toFixed(1)),
            color = this._getColor(artifact);

        return {
            marker: {
                radius: this._getRadius(artifact),
                symbol: this._getSymbol(artifact),
                fillColor: color
            },
            color: color,
            name: pointName,
            project: artifact.get('Project').Name,
            data: [[artifact.get('age'),artifact.get('density')]],
            showInLegend: false
        };
    },
    _getRadius: function(artifact){
        var sizeMultiplier = this.sizeMultiplierMap[artifact.get('_type')] || 1;
        return artifact.get('size') * sizeMultiplier;
    },
    _getColor: function(artifact){
        var hexColor = this.colorMap[artifact.get('Project')._ref] || this.defaultColor;
        return this._hexToRGBAColorString(hexColor, '.5');
    },
    _getSymbol: function(artifact){
        return this.symbolMap[artifact.get('_type')] || "square";
    },
    _getRiskScore: function(story){
        return story.get(this.riskField) ? 1 : 0;
    },
    _getAge: function(artifact, ageField, maxAgeThreshhold){
       var ageInHours = Rally.util.DateTime.getDifference(new Date(), Rally.util.DateTime.fromIsoString(artifact.get(ageField)), 'hour') || 0,
           ageInDays = ageInHours / 24;

        if (maxAgeThreshhold){
           return Math.min(ageInDays, maxAgeThreshhold);
       }
       return ageInDays;

    },
    _hexToRGBAColorString: function(hex, alpha) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

        if (result){
            return Ext.String.format("rgba({0},{1},{2},{3})",
                parseInt(result[1], 16),
                parseInt(result[2], 16),
                parseInt(result[3], 16),
                alpha
            );
        }
        return hex;
    },
    _getTreeArray:function(records, currentProjectRef) {

        var projectHash = {};
        _.each(records, function(rec){
            projectHash[rec.get('ObjectID')] = rec;

        });
        var current_root = null;


        var root_array = [];
        Ext.Object.each(projectHash, function(oid,item){

            if ( !item.get('Children') ) { item.set('Children',[]); }
            var direct_parent = item.get('Parent');
            if (!direct_parent && !Ext.Array.contains(root_array,item)) {
                root_array.push(item);
            } else {

                var parent_oid =  direct_parent.ObjectID || direct_parent.get('ObjectID');

                if (!projectHash[parent_oid]) {
                    if ( !Ext.Array.contains(root_array,item) ) {
                        root_array.push(item);
                    }
                } else {
                    var parent = projectHash[parent_oid];
                    if ( !parent.get('Children') ) { parent.set('Children',[]); }
                    var kids = parent.get('Children');
                    kids.push(item);
                    parent.set('Children',kids);
                }
            }
            if (item.get('_ref') == currentProjectRef){
                current_root = item;
            }
        },this);

        return current_root;
    },
    _getSampleSeries: function(){
        return [{
            marker: {
                radius: 15
            },

            name: 'Feature 1',
            color: 'rgba(223, 83, 83, .5)',
            data: [
                [61.2, 51.6],
                [67.5, 59.0],
                [59.5, 49.2],
                [57.0, 63.0],
                [55.8, 53.6],
                [70.0, 59.0],
                [59.1, 47.6]
            ]

        }, {
            marker: {
                radius: 25
            },

            name: 'Feature 2',
            color: 'rgba(255, 255, 0, .5)',
            data: [
                [31.2, 51.6],
                [57.5, 59.0],
                [49.5, 49.2],
                [87.0, 63.0],
                [95.8, 53.6],
                [20.0, 59.0],
                [19.1, 47.6]
            ]

        }, {
            marker: {
                radius: 5
            },

            name: 'Feature 3',
            color: 'rgba(119, 152, 191, .5)',
            data: [
                [74.0, 65.6],
                [75.3, 71.8],
                [93.5, 80.7],
                [86.5, 72.6],
                [87.2, 78.8],
                [81.5, 74.8],
                [84.0, 86.4],
                [73.5, 81.8]
            ]
        },  {
            marker: {
                radius: 20
            },

            name: 'Feature 4',
            color: 'rgba(255, 0, 100, .5)',
            data: [
                [34.0, 55.6],
                [85.3, 51.8],
                [43.5, 30.7],
                [66.5, 82.6],
                [57.2, 38.8],
                [21.5, 24.8],
                [44.0, 56.4],
                [33.5, 41.8]
            ]
        }];
    }
});