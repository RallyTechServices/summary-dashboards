Ext.define('Rally.technicalservices.ProjectValidationRules',{
    extend: 'Rally.technicalservices.ValidationRules',
    //ruleFnPrefix: 'ruleFn_',
    requiredFields: ['Owner'], //
    /**
     * 
     * @config {Ext.data.Model}  
     * 
     * An array of the preferences where the names contain 'project-wip'
     */
    projectPrefs: [],
    
    constructor: function(config){
        Ext.apply(this, config);
    },
    ruleFn_projectMissingWIP: function(r) {
        // set the project to itself so that we can use it in the chart
        r.set('Project',r.getData());
        
        var missingWIPTypes = [];
        var checkWIPTypes = ["Completed","Defined","In-Progress"];
        
        var prefs = this._getPrefForProject(r.get('Name'));

        Ext.Array.each(checkWIPTypes, function(checkType){
            if ( !prefs[checkType] || prefs[checkType] === "" || prefs[checkType] == "0" ) {
                missingWIPTypes.push(checkType);
            }
        });
        
        if (missingWIPTypes.length === 0) {
            return null;
        }
        return {
            rule: 'ruleFn_projectMissingWIP',
            text: Ext.String.format('<li>Project Missing WIP: {0}', missingWIPTypes.join(','))
        };
    },
    
    _getPrefForProject: function(project_name) {
        var prefs = {};
        var projectRegex = new RegExp(project_name);
        Ext.Array.each(this.projectPrefs, function(pref){
            var key = pref.get('Name');
            // project-wip:IA-Program > OR Solution Architecture Team:CompletedWIP
            //"project-wip:" + projectname + ":" + state + "WIP";
            if ( projectRegex.test(key) ) {
                var type = _.last(key.split(':')).replace(/WIP.*$/,'');
                prefs[type] = Ext.JSON.decode(pref.get('Value'));
            }
        });
        return prefs;
    }
});

