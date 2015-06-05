/** this class is configured with { series : [] } where series is a single dimensional array of 
    data values that is filled to full extent of the date range with future values filled with 
    nulls.
**/
Ext.define("ProjectStories", function() {

    var self;

    return {
        config : {
            ctx : {},
            filter : null
        },

        constructor:function(config) {
            self = this;
            this.initConfig(config);
            return this;
        },

        readProjectStories : function(callback) {
            var fns = [
                self.readStates.bind(self),
                self.readProjects.bind(self),
                self.getReportProjects.bind(self),
                self.readStories.bind(self)
            ];

            async.waterfall( fns , function(err,result) {
                callback( null, result, self.reportProjects, self.scheduleStates );
            });
        },

        readStates : function(callback) {
            var that = this;
            Rally.data.ModelFactory.getModel({
                type: 'UserStory',
                success: function(model) {
                    model.getField('ScheduleState').getAllowedValueStore().load({
                        callback: function(records, operation, success) {
                            self.scheduleStates = _.map(records,function(r){ return r.get("StringValue");});
                            callback(null);
                        }
                    });
                }
            });
        },

        readProjects : function(callback) {
            var that = this;
            var config = { model : "Project", fetch : true, filters : [] };
            self._wsapiQuery(config,callback);
        },    

        // child projects are what we graph
        getReportProjects : function(projects,callback) {

           self.projects = projects;

            // filter to projects which are child of the current context project
            self.reportProjects = _.filter(projects, function(project) {
                return self._isChildOf( project, self.ctx.getProject() );
            });

            // if no children add self
            if (self.reportProjects.length ===0) {
                self.reportProjects.push(_.find(self.projects,function(project) {
                    return project.get("ObjectID") === self.ctx.getProject().ObjectID;
                }));
            }

            callback(null);
        },

        readStories : function(callback) {

            var configs = _.map(self.reportProjects,function(project) {
                return {
                    model : "HierarchicalRequirement",
                    filters : [self.filter],
                    fetch : ["ObjectID","ScheduleState","PlanEstimate","Project"],
                    context : {
                        project: project.get("_ref"),
                        projectScopeUp: false,
                        projectScopeDown: true
                    }
                };
            });

            // read stories for each reporting project
            async.map(configs,self._wsapiQuery,function(error,results) {
                callback(null,results);
            });
        },
         

        _wsapiQuery : function( config , callback ) {

            var storeConfig = {
                autoLoad : true,
                limit : "Infinity",
                model : config.model,
                fetch : config.fetch,
                filters : config.filters,
                listeners : {
                    scope : this,
                    load : function(store, data) {
                        callback(null,data);
                    }
                }
            };
            if (!_.isUndefined(config.context)) {
                storeConfig.context = config.context;
            }         
            Ext.create('Rally.data.WsapiDataStore', storeConfig);
        },

        _isChildOf : function( child, parent ) {
            var childParentRef = !_.isNull(child.get("Parent")) ? child.get("Parent")._ref : "null";
            return parent._ref.indexOf( childParentRef ) > -1;
        }
        
    };
   
});