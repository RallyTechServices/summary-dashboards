Ext.define("work-item-field-issues", {
        extend: 'Rally.app.App',
        componentCls: 'app',
        logger: new Rally.technicalservices.Logger(),

        /**
         * Configurations
         */
        allReleasesText: 'All Releases',
        portfolioItemFeature: 'PortfolioItem/Feature',
        featureFetchFields: ['FormattedID','Name','Project','Release','State','AcceptedLeafStoryCount','LeafStoryCount','PlannedStartDate','PlannedEndDate','Owner'],
        storyFetchFields: ['FormattedID','Name','Project','Iteration','Release','ScheduleState','Feature','Owner','PlanEstimate'],
        iterationFetchFields: ['Name','StartDate','EndDate','State','ObjectID'],


        typeMapping: {
            'portfolioitem/feature': 'Feature',
            'hierarchicalrequirement': 'User Story'
        },

        chartColors: [ '#2f7ed8', '#8bbc21', '#910000',
            '#492970', '#f28f43', '#145499','#77a1e5', '#c42525', '#a6c96a',
            '#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9','#aa1925',
            '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1','#1aadce',
            '#4572A7', '#AA4643', '#89A54E', '#80699B', '#3D96AE',
            '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92'],

        launch: function() {
            this._addReleaseSelector();
        },
        getIterationFilters: function(){
            var release = this.getReleaseRecord();

            if (release == null || release.get('Name') == this.allReleasesText){
                return [];
            }

            var filters = Rally.data.wsapi.Filter.and([{
                property: 'StartDate',
                operator: '<',
                value: Rally.util.DateTime.toIsoString(release.get('ReleaseDate'))
            },{
                property: 'EndDate',
                operator: '>',
                value: Rally.util.DateTime.toIsoString(release.get('ReleaseStartDate'))
            }]);
            return filters;
        },

        getReleaseFilters: function(){

            var release = this.getReleaseRecord();

            return [{
                property: 'Release.Name',
                value: release.get('Name')
            },{
                property: 'Release.ReleaseStartDate',
                value: Rally.util.DateTime.toIsoString(release.get('ReleaseStartDate'))
            },{
                property: 'Release.ReleaseDate',
                value: Rally.util.DateTime.toIsoString(release.get('ReleaseDate'))
            }];
        },

        onReleaseUpdated: function(cb){
            this.logger.log('onReleaseUpdated',cb.getValue());
            this.getBody().removeAll();

            this.setLoading(true);
            var promises = [
                this._fetchData(this.portfolioItemFeature, this.featureFetchFields, this.getReleaseFilters()),
                this._fetchData('HierarchicalRequirement', this.storyFetchFields, this.getReleaseFilters()),
                this._fetchData('Iteration', this.iterationFetchFields, this.getIterationFilters())
            ];

            Deft.Promise.all(promises).then({
                scope: this,
                success: function(records){
                    this.setLoading(false);
                    this.logger.log('_fetchData success', records);

                    var featureRules = Ext.create('Rally.technicalservices.FeatureValidationRules',{
                            stories: records[1],
                            iterations: records[2]
                        }),
                        featureValidator = Ext.create('Rally.technicalservices.Validator',{
                            validationRuleObj: featureRules,
                            records: records[0]
                        });

                    var storyRules = Ext.create('Rally.technicalservices.UserStoryValidationRules',{}),
                        storyValidator = Ext.create('Rally.technicalservices.Validator',{
                            validationRuleObj: storyRules,
                            records: records[1]
                        });

                    this.logger.log('featureStats',featureValidator.ruleViolationData, storyValidator.ruleViolationData);

                    this.validatorData = featureValidator.ruleViolationData.concat(storyValidator.ruleViolationData);
                    this._createSummaryHeader(this.validatorData);

                },
                failure: function(operation){
                    this.setLoading(false);
                    this.logger.log('_fetchData failure', operation);
                }
            });
        },
        _createSummaryHeader: function(validatorData){
            this.logger.log('_createSummaryHeader',validatorData);

            var ct_summary = this.getBody().add({
                xtype: 'container',
                layout: {type: 'hbox'}
            });

            var ct_chart = ct_summary.add({
                xtype: 'container',
                flex: 1,
                minHeight: 300
            });

            this._createSummaryChart(ct_chart, validatorData);

            var ct_detail_grid = this.getBody().add({
                xtype: 'container'
            });
            this._createDetailGrid(ct_detail_grid, validatorData);

        },
        _onPointSelect: function(thisApp, thisPoint){
            thisApp.logger.log('_onPointSelect', thisPoint);

           var ruleName = thisPoint.id;
           var grid = thisApp.down('#detail-grid');

            grid.getStore().clearFilter(true);

            grid.getStore().filterBy(function(rec){
                var violations = rec.get('violations'),
                    filter = false;
                if (violations){
                    _.each(violations, function(v){
                        if (v.rule == ruleName){
                            filter = true;
                        }
                    });
                }
                return filter;
            });
        },
        _onPointUnselect: function(thisApp, fromPoint){
            if (fromPoint.selected){
                thisApp.down('#detail-grid').getStore().clearFilter();
            }
        },
        _createSummaryChart: function(ct,validatorData){

            //var categories [];
            //
            //_.each(categories, function(c){
            //    series.push({
            //        name: 'xxx',
            //        data: [],
            //        stack: type,
            //        point: {
            //            events: {
            //                select: function () {
            //                    me._onPointSelect(me, this);
            //                },
            //                unselect: function () {
            //                    me._onPointUnselect(me, this);
            //                }
            //            }
            //        }
            //    });
            //});
            //
            //var grid = this.down('#detail-grid');
            //
            //var me = this;
            //ct.add({
            //    xtype: 'rallychart',
            //    itemId: 'summary-chart',
            //    loadMask: false,
            //    chartData: {
            //        series: series
            //    },
            //    chartConfig: {
            //        chart: {
            //            type: 'column'
            //        },
            //        title: 'Work Item Field Issues',
            //        legend: {
            //            align: 'center',
            //            verticalAlign: 'bottom'
            //        },
            //        xAxis: {
            //            categories: categories
            //        },
            //        yAxis: {
            //            title: 'Project'
            //        },
            //        plotOptions: {
            //            column: {
            //               stacking: 'normal'
            //                }
            //            }
            //        }
            //    });
        },
        _createDetailGrid: function(ct, violationData){

            ct.removeAll();

            var store = Ext.create('Rally.data.custom.Store',{
                data: violationData,
                pageSize: violationData.length,
                //groupField: 'Project',
                //groupDir: 'ASC',
                remoteSort: false,
                //getGroupString: function(record) {
                //    return record.get('Project');
                //}
            });

            ct.add({
                xtype:'rallygrid',
                store: store,
                itemId: 'detail-grid',
                columnCfgs: this._getColumnCfgs(),
                showPagingToolbar: false
                //features: [{
                //    ftype: 'groupingsummary',
                //    groupHeaderTpl: '{name} ({rows.length})',
                //    startCollapsed: true
                //}]
            });
        },
        _getColumnCfgs: function(){
            return [{
                dataIndex: 'FormattedID',
                text: 'FormattedID',
                renderer: this._artifactRenderer
            },{
                dataIndex: 'Project',
                text: 'Project'
            },{
                dataIndex: 'violations',
                text:'Issues',
                renderer: this._validatorRenderer,
                flex: 1
            }];
        },
        _artifactRenderer: function(v,m,r){
            return Rally.nav.DetailLink.getLink({
                record: r,
                text: v
            });
            return v;
        },
        _validatorRenderer: function(v,m,r){
            var issues = '';
            if (v && v.length > 0){
                _.each(v, function(va){
                    issues += va.text + '<br/>';
                });
            }
            return issues;
        },
        _fetchData: function(modelType, fetchFields, filters){

            var deferred = Ext.create('Deft.Deferred'),
                store = Ext.create('Rally.data.wsapi.Store',{
                    model: modelType,
                    limit: 'Infinity',
                    fetch: fetchFields,
                    filters: filters
                });

            store.load({
                scope: this,
                callback: function(records, operation, success){
                    if (success){
                        deferred.resolve(records);
                    } else {
                        deferred.reject(operation);
                    }
                }
            });
            return deferred;
        },

        _addReleaseSelector: function(){
            this.logger.log('_addReleaseSelector');
            var cb = this.getHeader().add({
                xtype: 'rallyreleasecombobox',
                itemId: 'cb-release',
                fieldLabel: 'Release',
                labelAlign: 'right',
                allowNoEntry: false,
                width: '300'
            });
            cb.on('change', this.onReleaseUpdated,this);
        },


        getReleaseRecord: function(){
            if (this.down('#cb-release')){
                return this.down('#cb-release').getRecord();
            }
            return null;
        },

        getHeader: function(){
            this.logger.log('getHeader');

            if (this.down('#ct-header')){
                return this.down('#ct-header');
            }

            return this.add({
                xtype: 'container',
                itemId: 'ct-header',
                layout: {type: 'hbox'}
            });
        },

        getBody: function(){
            this.logger.log('getBody');

            if (this.down('#ct-body')){
                return this.down('#ct-body');
            }
            return this.add({
                xtype: 'container',
                itemId: 'ct-body'
            });
        }
    });
