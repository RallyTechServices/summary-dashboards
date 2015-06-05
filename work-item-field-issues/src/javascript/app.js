Ext.define("work-item-field-issues", {
        extend: 'Rally.app.App',
        componentCls: 'app',
        logger: new Rally.technicalservices.Logger(),
        items: [{xtype: 'container', itemId: 'settings_box'}],
        /**
         * Configurations
         */
        allReleasesText: 'All Releases',
        portfolioItemFeature: 'PortfolioItem/Feature',
        featureFetchFields: ['FormattedID','Name','Project','Release','State','AcceptedLeafStoryCount','LeafStoryCount','PlannedStartDate','PlannedEndDate','Owner','ActualStartDate','Parent','ValueScore','c_ValueMetricKPI'],
        storyFetchFields: ['FormattedID','Name','Project','Iteration','Release','ScheduleState','Feature','Owner','PlanEstimate','Blocked','BlockedReason',],


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
            if (this.isExternal()){
                this.showSettings(this.config);
            } else {
                this.onSettingsUpdate(this.getSettings());
            }
        },
    onTimeboxScopeChange: function(newTimeboxScope) {
        this.logger.log('newTimeboxScope',newTimeboxScope);

        if (((newTimeboxScope) && (newTimeboxScope.get('_type') === 'release'))
                            ||!newTimeboxScope) { //If the timebox scope is null, then just load all stories in the project scope.
            this.onTimeboxUpdated(newTimeboxScope);
        }
     },

        getReleaseFilters: function(release){

            if (!release){
                return [];
            }

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

        onTimeboxUpdated: function(release){
            this.logger.log('onReleaseUpdated',release);
            this.getBody().removeAll();

            this.setLoading(true);
            var promises = [
                this._fetchData(this.portfolioItemFeature, this.featureFetchFields, this.getReleaseFilters(release)),
                this._fetchData('HierarchicalRequirement', this.storyFetchFields, this.getReleaseFilters(release))
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

            var dataHash = {}, projects = [], types = [], rules = [];

            _.each(validatorData, function(obj){
                if (!_.contains(projects,obj.Project)){
                    projects.push(obj.Project);
                }
                if (!_.contains(types, obj._type)){
                    types.push(obj._type);
                }
                if (!dataHash[obj.Project]){
                    dataHash[obj.Project] = {};
                }
                if (!dataHash[obj.Project][obj._type]){
                    dataHash[obj.Project][obj._type] = {};
                }
                _.each(obj.violations, function(v){
                    if (!_.contains(rules, v.rule)){
                        rules.push(v.rule);
                    }
                    dataHash[obj.Project][obj._type][v.rule] = (dataHash[obj.Project][obj._type][v.rule] || 0) + 1;
                });
            });

            console.log('data',validatorData, dataHash, projects, types, rules);
            projects.sort();

            var series = [];

            _.each(types, function(t){
                _.each(rules, function(r){
                    var data = [];
                    _.each(projects, function(p){
                        if (dataHash[p] && dataHash[p][t]){
                            data.push(dataHash[p][t][r] || 0);
                        } else {
                            data.push(0);
                        }
                    });
                    series.push({
                        name: Rally.technicalservices.ValidationRules.getUserFriendlyRuleLabel(r),
                        data: data,
                        stack: t,
                        showInLegend: Ext.Array.sum(data) > 0,
                        point: {
                            events: {
                                select: function () {
                                    me._onPointSelect(me, this);
                                },
                                unselect: function () {
                                    me._onPointUnselect(me, this);
                                }
                            }
                        }
                    });
                });
            });

            var grid = this.down('#detail-grid');

            var me = this;
            ct.add({
                xtype: 'rallychart',
                itemId: 'summary-chart',
                loadMask: false,
                chartData: {
                    series: series,
                    categories: projects
                },
                chartConfig: {
                    chart: {
                        type: 'column'
                    },
                    title: 'Work Item Field Issues',
                    legend: {
                        align: 'center',
                        verticalAlign: 'bottom'
                    },
                    xAxis: {
                        categories: projects
                    },
                    yAxis: {
                        title: 'Project'
                    },
                    plotOptions: {
                        column: {
                           stacking: 'normal'
                            }
                        }
                    }
                });
        },
        _createDetailGrid: function(ct, violationData){

            ct.removeAll();

            var store = Ext.create('Rally.data.custom.Store',{
                data: violationData,
                pageSize: violationData.length,
                groupField: 'Project',
                groupDir: 'ASC',
                remoteSort: false,
                getGroupString: function(record) {
                    return record.get('Project');
                }
            });

            ct.add({
                xtype:'rallygrid',
                store: store,
                itemId: 'detail-grid',
                columnCfgs: this._getColumnCfgs(),
                showPagingToolbar: false,
                features: [{
                    ftype: 'groupingsummary',
                    groupHeaderTpl: '{name} ({rows.length})',
                    startCollapsed: true
                }]
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
        getHeader: function(){
            this.logger.log('getHeader');

            if (this.down('#ct-header')){
                return this.down('#ct-header');
            }

            return this.add({
                xtype: 'container',
                itemId: 'ct-header',
                //layout: {type: 'hbox'}
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
        },
    /********************************************
     /* Overrides for App class
     /*
     /********************************************/
    //getSettingsFields:  Override for App
    getSettingsFields: function() {
        return [
            {
                name: 'showScopeSelector',
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel: 'Show Scope Selector<br/><span style="color:#999999;"><i>Tick to use this to broadcast settings.</i></span>'
            }];
    },
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    //showSettings:  Override
    showSettings: function(options) {
        this._appSettings = Ext.create('Rally.app.AppSettings', Ext.apply({
            fields: this.getSettingsFields(),
            settings: this.getSettings(),
            defaultSettings: this.getDefaultSettings(),
            context: this.getContext(),
            settingsScope: this.settingsScope,
            autoScroll: true
        }, options));

        this._appSettings.on('cancel', this._hideSettings, this);
        this._appSettings.on('save', this._onSettingsSaved, this);
        if (this.isExternal()){
            if (this.down('#settings_box').getComponent(this._appSettings.id)==undefined){
                this.down('#settings_box').add(this._appSettings);
            }
        } else {
            this.hide();
            this.up().add(this._appSettings);
        }
        return this._appSettings;
    },
    _onSettingsSaved: function(settings){
        Ext.apply(this.settings, settings);
        this._hideSettings();
        this.onSettingsUpdate(settings);
    },
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        Ext.apply(this, settings);

        var release = null;

        if ( this.getSetting('showScopeSelector') || this.getSetting('showScopeSelector') == "true" ) {
            var tb = this.getHeader().add({
                xtype : 'timebox-selector',
                context : this.getContext(),
                listeners: {
                    releasechange: function(release){
                        this.onTimeboxScopeChange(release);
                    },
                    //iterationchange: function(iteration){
                    //    this.onTimeboxScopeChange(iteration);
                    //},
                    scope: this
                }
            });
            release = tb.getReleaseRecord();
            //iteration = tb.getIterationRecord();
            this.onTimeboxScopeChange(release);
        } else {
            this.onTimeboxScopeChange(release);
            this.subscribe(this, 'timeboxReleaseChanged', this.onTimeboxScopeChange, this);
            this.subscribe(this, 'timeboxIterationChanged', this.onTimeboxScopeChange, this);
            this.publish('requestTimebox', this);
        }
    }
});
