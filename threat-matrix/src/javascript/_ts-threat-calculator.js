Ext.define('Rally.technicalservices.ThreatCalculator', {
    logger: new Rally.technicalservices.Logger(),

    /**
     * @cfg {Number}
     * Colors to be applied in order (must be HSLA)
     * We'll take them and put them into the first part of:
     * 'hsla(235,100%,75%,1)'
     * where 25 is the color, 100% is the saturation, 75% is the lightness (100% is white), 1 is the opacity
     *
     * NICE SITE: http://hslpicker.com/
     *
     */
    colors: [209, 235, 20, 126, 180, 50, 84 ],


    chartColors: [ '#2f7ed8', '#8bbc21', '#910000',
        '#492970', '#f28f43', '#145499','#77a1e5', '#c42525', '#a6c96a',
        '#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9','#aa1925',
        '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1','#1aadce',
        '#4572A7', '#AA4643', '#89A54E', '#80699B', '#3D96AE',
        '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92'],

    dependencyColors: ['#FF0000','#00FF00','#0000FF','#00FFFF', '#FFFF00','#FF00FF','#FF9966','#6600FF','#996633'],
    genericDependencyColor: '#000000',
    noDependencyColor: '#FFFFFF',

    config: {
        riskField: undefined,
        currentProjectRef: undefined,
        projects: undefined,
        maxFeatureAgeThreshhold: undefined,
        maxStoryAgeThreshhold: undefined,
        minAgeThreshhold: undefined,
        minPointsThreshhold: undefined,
        minSize: 3,
        andMinThreshholds: true,
        featureSizeMultiplier: undefined,
        storySizeMultiplier: undefined,
        riskMultiplier: undefined,
        iterationDays: undefined,
        releaseDays: undefined,
        showDataLabels: false,
        showDependencyColors: false,
        programRiskSize: undefined
    },
    /**
     * projectTree is used to show the hierarchy of the projects so that we can
     * determine which items to show (vs. which to include in the calculations)
     */
    projectTree: {},
    dependencyLineWidth: 2,
    dependencyMap: {},
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
        var deferred = Ext.create('Deft.Deferred');

        var featureStoryHash = {},
            promises = [];

        _.each(stories, function(s){

            s.set('riskCount', this._getRiskScore(s));
            s.set('totalCount', 1);
            s.set('size', s.get('PlanEstimate') );
            s.set('density', this._getStoryDensity(s));
            s.set('age', this._getAge(s, 'InProgressDate', this.maxStoryAgeThreshhold));
            if (s.get('Feature')){
                featureStoryHash[s.get('Feature')._ref] = featureStoryHash[s.get('Feature')._ref] || [];
                featureStoryHash[s.get('Feature')._ref].push(s);
            }
            if (this._includeInChart(s)){
                promises.push(this._getPredecessors(s));
            }
        }, this);

        _.each(features, function(f){
            var riskCount = 0, totalCount = 0;
            f.set('age', this._getAge(f, 'ActualStartDate', this.maxFeatureAgeThreshhold));
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
            f.set('predecessorFids', []);
        }, this);

        if (promises.length > 0){
            Deft.Promise.all(promises).then({
                scope: this,
                success: function(){
                    var artifacts = features.concat(stories);
                    this.logger.log('predecessors loaded', artifacts);
                    var series = [];
                    _.each(artifacts, function(a){
                        if (this._includeInChart(a)){
                            series.push(this._getSeries(a));
                        }
                    }, this);
                    this.logger.log('predecessors loaded -- series', series);
                    deferred.resolve({series: series});
                },
                failure: function(operation){
                    deferred.reject(operation);
                }
            });
        } else {

            var artifacts = features.concat(stories);
            this.logger.log('predecessors loaded', artifacts);

            var series = [];
            _.each(artifacts, function(a){
                if (this._includeInChart(a)){
                    series.push(this._getSeries(a));
                }
            }, this);
            this.logger.log('predecessors loaded -- series', series);
            deferred.resolve({series: series});

        }
        return deferred;
        //return {series: series};
    },
    _getPredecessors: function(artifact){
        this.logger.log('_getPredecessors', artifact.get('Predecessors'));
        var deferred = Ext.create('Deft.Deferred');

        if (artifact.get('Predecessors') && artifact.get('Predecessors').Count > 0 ){
            artifact.getCollection('Predecessors').load({
                scope: this,
                fetch: ['FormattedID'],
                callback: function(records, operation, success){
                    this.logger.log('predecessor store loaded', artifact.get('FormattedID'), success, records, operation);
                    var predecessorOids = [];
                    if (success) {
                        _.each(records, function(r){
                            if (!_.has(this.dependencyMap, r.get('FormattedID'))){
                                var color_index = _.keys(this.dependencyMap).length % this.dependencyColors.length;
                                this.dependencyMap[r.get('FormattedID')] = this.dependencyColors[color_index];
                            }
                            predecessorOids.push(r.get('FormattedID'));
                        }, this);
                        artifact.set('predecessorFids', predecessorOids);
                        deferred.resolve();
                    } else {
                        deferred.resolve(operation);
                    }
                }
            });
        } else {
            artifact.set('predecessorFids',[]);
            deferred.resolve();
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

        if (this._isProgramLevelRisk(artifact)){
            return true;
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
            projectLabelColorMap = {},
            i=0;

        //We only need to do this for the current and child projects since we are only looking at one
        //level of hierarchy at a time.
        colorMap[projectTree.get('_ref')] = this.chartColors[i++];
        projectLabelColorMap[projectTree.get('Name')] = colorMap[projectTree.get('_ref')];
        _.each(projectTree.get('Children'), function(child){
            colorMap[child.get('_ref')] = this.chartColors[i++];
            projectLabelColorMap[child.get('Name')] = colorMap[child.get('_ref')];
        }, this);
        this.projectLabelColorMap = projectLabelColorMap;
        return colorMap;
    },
    _isProgramLevelRisk: function(artifact){
        return  (this._isArtifactUserStory(artifact) == false &&
            artifact.get(this.riskField) == true &&
            artifact.get('LeafStoryCount') == 0 &&
            !artifact.get('Parent'));
    },
    _getSeries: function(artifact){
        this.logger.log('id, size, age, density',artifact.get('FormattedID'),artifact.get('size'),artifact.get('age'), artifact.get('density'),artifact.get('predecessorFids'))

        var isUserStory = this._isArtifactUserStory(artifact),
            color = this._getColor(artifact),
            hasDependency = artifact.get('predecessorFids') ? (artifact.get('predecessorFids').length > 0) : false,
            isDependencyColor = this.noDependencyColor,
            isDependencyWidth = 0,
            dependencies = [],
            isProgramLevelRisk = this._isProgramLevelRisk(artifact);


        var pointName = Ext.String.format("Project: {1}<br/>Size: {2}<br/>Age (days): {3}", artifact.get('FormattedID'),
                artifact.get('Project').Name,
                artifact.get('size'), artifact.get('age').toFixed(1));

        if (isProgramLevelRisk){
            isDependencyWidth = Math.max(this.programRiskSize-2, 1);
            isDependencyColor = color;
            color = '#FFFFFF';
            pointName = Ext.String.format("<b>Program Level Risk</b><br/>Project: {0}",
                artifact.get('Project').Name);
        }

        if (hasDependency){
            dependencies = artifact.get('predecessorFids').slice();
            pointName = Ext.String.format('{0}<br/>Dependencies [{1}]',pointName, dependencies.join(','));
        }
        if (_.has(this.dependencyMap, artifact.get('FormattedID'))){
            isDependencyColor = this.showDependencyColors ? this.dependencyMap[artifact.get('FormattedID')] || this.genericDependencyColor : this.genericDependencyColor;
            isDependencyWidth = this.dependencyLineWidth;
        }


        return {
            marker: {
                radius: this._getRadius(artifact),
                symbol: this._getSymbol(artifact),
                fillColor: color,
                lineColor: isDependencyColor,
                lineWidth: isDependencyWidth,
                states: {
                    select: {
                        fillColor: color,
                        lineColor: isDependencyColor,
                        lineWidth: isDependencyWidth
                    }
                }
            },
            color: color,
            name: artifact.get('FormattedID'),
            tooltip: {
                pointFormat: pointName,
                borderColor: '#000000'
            },
            dataLabels: {
                enabled: this.showDataLabels,
                color: 'black'
            },
            data: [{
                x: artifact.get('age'),
                y: artifact.get('density'),
                dependencies: dependencies,
                artifact: artifact.getData(),
                paths: []
            }],
            showInLegend: false,
            allowPointSelect: true,
            yAxis: isUserStory ? 1 : 0,
            xAxis: isUserStory ? 1 : 0,
            point: {
                events: {
                    click: this._pointClick,
                    select: this._drawDependency,
                    unselect: this._drawDependency
                }
            }
        };
    },
    
    _pointClick: function(evt) {
        var point = evt.point;
        if ( evt.altKey ) {
            console.log('alt click', point, evt);
            Rally.nav.Manager.showDetail(point.artifact._ref);
        }
    },
    
    _drawDependency: function(evt, point){
        if (!point){
            point = this;
        }
        this.paths = this.paths || [];

       if (evt.type == 'select' && this.paths.length == 0){

           var ren = this.series.chart.renderer;
           var plotLeft = point.series.chart.plotLeft,
                plotTop = point.series.chart.plotTop,
                x1 = point.series.points[0].plotX + plotLeft,
                y1 = point.series.points[0].plotY + plotTop,
                thisName = point.series.name,
                thisColor = point.series.options.marker.lineColor,
                thisRadius = point.series.options.marker.radius,
                    pointPaths = [];

                _.each(point.series.chart.series, function(s){
                    if (Ext.Array.contains(s.data[0].dependencies, thisName)){

                        var delta_y = y1 - (s.points[0].plotY + plotTop),
                            delta_x = x1 - (s.points[0].plotX + plotLeft),
                            dist = Math.sqrt(Math.pow((delta_x),2) + Math.pow((delta_y),2));

                        var ratio1 =  -thisRadius/dist,
                            dep_x = ratio1 * (delta_x) + x1,
                            dep_y = ratio1 * (delta_y) + y1;

                        var rad = s.options.marker.radius;
                        var ratio2 = (rad-dist)/dist,
                            pred_x = ratio2 * delta_x + x1,
                            pred_y = ratio2 * delta_y + y1;

                        pointPaths.push(ren.path(['M',dep_x, dep_y , 'L', pred_x, pred_y]) //s.points[0].plotX + plotLeft, s.points[0].plotY + plotTop])
                            .attr({
                                'stroke-width': 1,
                                stroke: thisColor,
                                'stroke-opacity': 0.5,
                                itemId: 'path-' + thisName
                            })
                            .add());
                    }
                }, this);
                this.paths = pointPaths;
            }

            if (evt.type == 'unselect'){
                _.each(this.paths, function(p) {
                    var parent = p.element.parentNode;
                    parent.removeChild(p.element);
                });
                this.paths = [];
            }
    },
    _getRadius: function(artifact){
        if (this._isProgramLevelRisk(artifact)){
            return this.programRiskSize;
        }

        var multiplier = this._isArtifactUserStory(artifact) ? this.storySizeMultiplier || 1 : this.featureSizeMultiplier || 1;
        return Math.max(artifact.get('size') * multiplier || 0, this.minSize);
    },
    _getColor: function(artifact){
        var hexColor = this.colorMap[artifact.get('Project')._ref] || this.defaultColor;
        var alpha = 1;
        if (this._isArtifactUserStory(artifact)){
            alpha = .5;
        }
        return this._hexToRGBAColorString(hexColor, alpha);
    },
    _getSymbol: function(artifact){
        return "circle"; //this.symbolMap[artifact.get('_type')] || "square";
    },
    _getStoryDensity: function(story){
        var multiplier = this._getRiskScore(story) > 0 ? this.riskMultiplier || 1 : 1;
        return story.get('PlanEstimate') * multiplier;
     },
    _getRiskScore: function(story){
        return story.get(this.riskField) > 0 ? 1 : 0;
    },
    _getAge: function(artifact, ageField, maxThreshhold){
       var ageInHours = Rally.util.DateTime.getDifference(new Date(), Rally.util.DateTime.fromIsoString(artifact.get(ageField)), 'hour') || 0,
           ageInDays = ageInHours / 24;
        return Math.min(ageInDays, maxThreshhold);
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
    _isArtifactUserStory: function(artifact){
        return artifact.get('_type') == 'hierarchicalrequirement';
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
    }
});