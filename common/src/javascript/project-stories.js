/** this class is configured with { series : [] } where series is a single dimensional array of 
    data values that is filled to full extent of the date range with future values filled with 
    nulls.
**/
Ext.define("ProjectStories", function() {

    var self;

    return {
        config : {
            ctx : {},
            filter : null,
            featureFilter : null
        },

        constructor:function(config) {
            self = this;
            this.initConfig(config);
            return this;
        },

        readProjectWorkItems : function(callback) {

            console.log('readProjectWorkItems', self.featureFilter);
            
            var fns = [
                self.readStates,
                self.readProjects,
                self.readStories
            ];

            if (self.featureFilter!==null) {
                fns = [
                    self.readStates,
                    self.readProjects,
                    self.readFeatures
                ];
            }

            Deft.Chain.pipeline(fns,self).then({
                success: function(workItems) {
                    callback( null, workItems, self.projects, self.scheduleStates);
                },
                failure: function(error) {
                    //oh noes!
                    console.log("Error:",error);
                }
            });
        },

        readStates : function() {
            var that = this;
            var deferred = Ext.create('Deft.Deferred');

            Rally.data.ModelFactory.getModel({
                type: 'UserStory',
                success: function(model) {
                    model.getField('ScheduleState').getAllowedValueStore().load({
                        callback: function(records, operation, success) {
                            self.scheduleStates = _.map(records,function(r){ return r.get("StringValue");});
                            deferred.resolve(self.scheduleStates);
                        }
                    });
                }
            });
            return deferred.promise;
        },

        readProjects : function(states) {

            var deferred = Ext.create('Deft.Deferred');
            var me = this;

            self._loadAStoreWithAPromise('Project', 
                ["_ref","Parent","Children"], 
                [
                    {property : "ObjectID" , operator : "=", value : self.ctx.getProject().ObjectID }
                ]).then({
                    scope: me,
                    success: function(projects) {
                        if ( _.first(projects).get('Children').Count === 0 ) {
                            self.projects = projects;
                            deferred.resolve(self.projects);
                        } else {
                            _.first(projects).getCollection('Children').load({
                                fetch : ["ObjectID","Name","_ref","Parent","State"],
                                callback: function(records, operation, success) {
                                    self.projects = _.filter(records,function(r) { return r.get("State")!=="Closed"; });
                                    deferred.resolve(self.projects);
                                }
                            });
                        }
                    }
            });
            return deferred.promise;
        },    

        readStories : function(projects) {
            console.log('readStories', projects, self.filter);
            var me = this;

            var promises = _.map(projects,function(project) {
                var deferred = Ext.create('Deft.Deferred');
                self._loadAStoreWithAPromise(
                    'HierarchicalRequirement', 
                    ["ObjectID","ScheduleState","PlanEstimate","Project"], 
                    [self.filter],
                    {   project: project.get("_ref"),
                        projectScopeUp: false,
                        projectScopeDown: true
                    }).then({
                    scope: me,
                    success: function(stories) {
                        console.log('stories',stories);
                        deferred.resolve(stories);
                    }
                });
                return deferred.promise;
            });

            return Deft.Promise.all(promises);

        },

        readFeatures : function(projects) {

            var me = this;

            var readFeatureType = function() {
                var deferred = Ext.create('Deft.Deferred');
                self._loadAStoreWithAPromise(
                    'TypeDefinition', 
                    ["TypePath"], 
                    [ { property:"Ordinal", operator:"=", value:0} ]
                    ).then({
                    scope: me,
                    success: function(types) {
                        deferred.resolve(_.first(types).get("TypePath"));
                    }
                });
                return deferred.promise;
            };

            var readFeatures = function(type) {

                var promises = _.map(projects,function(project) {
                    var deferred = Ext.create('Deft.Deferred');
                    self._loadAStoreWithAPromise(
                        type, 
                        ["FormattedID","Name","ObjectID","LeafStoryCount","LeafStoryPlanEstimateTotal",
                        "PreliminaryEstimate", "AcceptedLeafStoryCount", "AcceptedLeafStoryPlanEstimateTotal",
                        "PercentDoneByStoryCount","c_ValueMetricKPI","Rank","State"],
                        [self.featureFilter],
                        {   project: project.get("_ref"),
                            projectScopeUp: false,
                            projectScopeDown: true
                        },
                        [ { property : 'DragAndDropRank', direction : 'ASC' } ]).then({
                        scope: me,
                        success: function(stories) {
                            deferred.resolve(stories);
                        }
                    });
                    return deferred.promise;
                });

                return Deft.Promise.all(promises);
            };

            var deferred = Ext.create('Deft.Deferred');
            Deft.Chain.pipeline([readFeatureType,readFeatures],self).then({
                success: function(results) {
                    deferred.resolve(results);
                }
            });
            return deferred.promise;

        },

        readPreferenceValues : function(keys) {

            var me = this;

            var promises = _.map(keys,function(key) {
                var deferred = Ext.create('Deft.Deferred');
                self._loadAStoreWithAPromise(
                        "Preference", 
                        ["Name","Value"], 
                        [{ property : "Name", operator : "=", value : key }]
                    ).then({
                        scope: me,
                        success: function(values) {
                            deferred.resolve(values);
                        },
                        failure: function(error) {
                            deferred.resolve("");
                        }
                    });
                return deferred.promise;
            });
            return Deft.Promise.all(promises);
        },

        _loadAStoreWithAPromise: function(model_name, model_fields, filters,ctx,order){
            var deferred = Ext.create('Deft.Deferred');
            var me = this;
              
            var config = {
                model: model_name,
                fetch: model_fields,
                filters: filters,
                limit: 'Infinity'
            };
            if (!_.isUndefined(ctx)&&!_.isNull(ctx)) {
                config.context = ctx;
            }
            if (!_.isUndefined(order)&&!_.isNull(order)) {
                config.order = order;
            }

            Ext.create('Rally.data.wsapi.Store', config ).load({
                callback : function(records, operation, successful) {
                    if (successful){
                        deferred.resolve(records);
                    } else {
                        deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                    }
                }
            });
            return deferred.promise;
        }
    };
});