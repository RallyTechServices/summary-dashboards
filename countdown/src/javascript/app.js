Ext.define("TSCountdown", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'settings_box'},
        {xtype:'container', itemId:'selector_box' },
        {xtype:'container', layout:{ type:'table', columns: 3, tableAttrs:{style:{width:'100%', 'table-layout': 'fixed'}} }, items:[
            {xtype:'tscountdown',itemId:'release_counter',fieldLabel:'Program Increment'},
            {xtype:'container', flex: 1, html: ' ' },
            {xtype:'tscountdown',itemId:'iteration_counter',fieldLabel:'Sprint/Iteration', cls: 'blue_text'}
        ]},
        {xtype:'tsinfolink'}
    ],
    config: {
        defaultSettings: {
            showScopeSelector:  true
        }
    },
    launch: function() {

        if (this.isExternal()){
            this.showSettings(this.config);
        } else {
            this.onSettingsUpdate(this.getSettings());
        }
    },

    _launch: function(settings) {
        var me = this;

        if ( settings.showScopeSelector == true || settings.showScopeSelector == "true" ) {
            this.down('#selector_box').add({
                xtype : 'timebox-selector',
                context : this.getContext(),
                listeners: {
                    releasechange: function(release){
                        this._changeRelease(release);
                    },
                    iterationchange: function(iteration){
                        this._changeIteration(iteration);
                    },
                    scope: this

                }
            });
        } else {
            console.log("Countdown, subscribing");
            this.subscribe(this, 'timeboxReleaseChanged', this._changeRelease, this);
            this.subscribe(this, 'timeboxIterationChanged', this._changeIteration, this);

            this.publish('requestTimebox', this);
        }
   },
    _changeRelease: function(timebox) {
        this.logger.log("_changeRelease", timebox);

        this.down('#release_counter').setEndDate(timebox.get('ReleaseDate') );
        this.down('#release_counter').text = timebox.get('Name') + ": " + timebox.get('ReleaseDate');

    },
    _changeIteration: function(timebox) {
        this.logger.log("_changeIteration", timebox);

        this.down('#iteration_counter').setEndDate( timebox.get('EndDate') );
        this.down('#iteration_counter').text = timebox.get('Name') + ": " + timebox.get('EndDate');

    },
    _changeRelease: function(timebox) {
        this.logger.log("_changeRelease", timebox);
        
        this.down('#release_counter').setEndDate(timebox.get('ReleaseDate') );
        this.down('#release_counter').text = timebox.get('Name') + ": " + timebox.get('ReleaseDate');
        
    },
    _changeIteration: function(timebox) {
        this.logger.log("_changeIteration", timebox);
        
        if ( Ext.isEmpty(timebox) ) {
            this.down('#iteration_counter').setEndDate( new Date() );
            this.down('#iteration_counter').text = "None selected";
        } else {
            this.down('#iteration_counter').setEndDate( timebox.get('EndDate') );
            this.down('#iteration_counter').text = timebox.get('Name') + ": " + timebox.get('EndDate');
        }
    },
    _loadAStoreWithAPromise: function(model_name, model_fields, filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);

        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: filters
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    /********************************************
     /* Overrides for App class
     /*
     /********************************************/
    //getSettingsFields:  Override for App
    getSettingsFields: function() {
        var me = this;

        return [
            {
                name: 'showScopeSelector',
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel: 'Show Scope Selector<br/><span style="color:#999999;"><i>Tick to use this to broadcast settings.</i></span>'
            }
        ];
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
        this._launch(settings);
    }
});
