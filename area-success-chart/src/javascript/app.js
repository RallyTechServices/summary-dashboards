Ext.define("AreaSuccessChart", {
    extend : 'Rally.app.App',
    componentCls : 'app',
    logger : new Rally.technicalservices.Logger(),
    defaults : {
        margin : 10
    },
    items : [{
        xtype : 'container',  itemId : 'settings_box'
    }, {
        xtype : 'container',  itemId : 'selector_box'
    }, {
        xtype : 'container',  itemId : 'display_box'
    }],

    launch : function() {

        if (this.isExternal()) {
            this.showSettings(this.config);
        } else {
            this.onSettingsUpdate(this.getSettings());
        }
    },

    _launch : function(settings) {
         var that = this;

        if (settings.showScopeSelector === true
                || settings.showScopeSelector === "true") {
            this.down('#selector_box').add({
                xtype : 'timebox-selector',
                context : this.getContext(),
                listeners : {
                    releasechange : function(release) {
                        this._changeRelease(release);
                    },
                    iterationchange : function(iteration) {
                        this._changeIteration(iteration);
                    },
                    scope : this

                }
            });
        } else {
            this.subscribe(this, 'timeboxReleaseChanged', 
                this._changeRelease, this);
            this.subscribe(this, 'timeboxIterationChanged',
                    this._changeIteration, this);
            this.publish('requestTimebox', this);
        }

        // that.run(release,iteration);
    },

    _changeRelease : function(release) {
        this.run(release.get("Name"), null);
    },

    _changeIteration : function(iteration) {
        if (!Ext.isEmpty(iteration)) {
            this.run(null, iteration.get("Name"), null);
        }
    },

    run : function(releaseName, iterationName) {
        this.setLoading('Loading Data...');
        
        var chart_by_features = this.getSetting('features') === true;
        

        if ( chart_by_features ) {
            
        } else {
            this._loadStates().then();
            //this._loadItems().then();
        }
        
        this._makeChart();
    },
    
    _loadStates: function() {
        var deferred = Ext.create('Deft.Deferred');
        Rally.data.ModelFactory.getModel({
            type: 'UserStory',
            success: function(model) {
                model.getField('ScheduleState').getAllowedValueStore().load({
                    callback: function(records, operation, success) {
                        var scheduleStates = Ext.Array.map(records,function(r){ return r.get("StringValue");});
                        deferred.resolve(scheduleStates);
                    }
                });
            }
        });
        return deferred.promise;
    },
    
    _makeChart: function() {
        this.setLoading(false);
        
        var categories = ["Wilma","Fred","Pebbles"];
        
        var series = [
            {type:'column',name:'A Series 2',data:[5,0,7],stack:3},
            {type:'line',name:'A Series',data:[5,null,7],stack:3},
            {type:'column',name:'Another One', data:[3,5,12], stack: 1},
            {type:'column',name:'Another Series',data:[1,6,3],stack:1}
        ];
        
        this.down('#display_box').add({
            loadMask: false,
            xtype:'rallychart',
            chartData: {
                series: series
            },
            chartColors: ['red','blue','green','yellow'],
            chartConfig: {
                chart: {},
                title: {
                    text: 'title',
                    align: 'center'
                },
                xAxis: [{
                    categories:  categories,
                    labels: {
                        align: 'left',
                        rotation: 70
                    }
                }],
                plotOptions: {
                    series: {
                        stacking: 'normal'
                    }
                }
            }
        });
    },

    _loadItems : function(model_name, model_fields) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:", model_name, model_fields);

        Ext.create('Rally.data.wsapi.Store', {
            model : model_name,
            fetch : model_fields
        }).load({
            callback : function(records, operation, successful) {
                if (successful) {
                    deferred.resolve(this);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: '
                            + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _displayGrid : function(store, field_names) {
        this.down('#display_box').add({
            xtype : 'rallygrid',
            store : store,
            columnCfgs : field_names
        });
    },

    getOptions : function() {
        return [{
            text : 'About...',
            handler : this._launchInfo,
            scope : this
        }];
    },

    _launchInfo : function() {
        if (this.about_dialog) {
            this.about_dialog.destroy();
        }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink', {});
    },

    isExternal : function() {
        return typeof(this.getAppId()) == 'undefined';
    },
    // showSettings: Override
    showSettings : function(options) {
        this._appSettings = Ext.create('Rally.app.AppSettings', Ext.apply({
            fields : this.getSettingsFields(),
            settings : this.getSettings(),
            defaultSettings : this.getDefaultSettings(),
            context : this.getContext(),
            settingsScope : this.settingsScope,
            autoScroll : true
        }, options));

        this._appSettings.on('cancel', this._hideSettings, this);
        this._appSettings.on('save', this._onSettingsSaved, this);
        if (this.isExternal()) {
            if (this.down('#settings_box').getComponent(this._appSettings.id) === undefined) {
                this.down('#settings_box').add(this._appSettings);
            }
        } else {
            this.hide();
            this.up().add(this._appSettings);
        }
        return this._appSettings;
    },
    _onSettingsSaved : function(settings) {
        Ext.apply(this.settings, settings);
        this._hideSettings();
        this.onSettingsUpdate(settings);
    },
    // onSettingsUpdate: Override
    onSettingsUpdate : function(settings) {
        Ext.apply(this, settings);
        this._launch(settings);
    },

    getSettingsFields : function() {
        var me = this;

        return [{
            name : 'showScopeSelector',
            xtype : 'rallycheckboxfield',
            boxLabelAlign : 'after',
            fieldLabel : '',
            margin : '0 0 25 200',
            boxLabel : 'Show Scope Selector<br/><span style="color:#999999;"><i>Tick to use this to broadcast settings.</i></span>'
        }, {
            name : 'features',
            xtype : 'rallycheckboxfield',
            boxLabelAlign : 'after',
            fieldLabel : '',
            margin : '0 0 25 200',
            boxLabel : '% based on features (otherwise stories)'
        }];
    }
});
