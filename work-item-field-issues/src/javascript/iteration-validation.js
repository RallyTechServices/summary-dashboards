Ext.define('Rally.technicalservices.IterationValidationRules',{
    extend: 'Rally.technicalservices.ValidationRules',
    //ruleFnPrefix: 'ruleFn_',
    requiredFields: ['PlannedVelocity'], //
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
    ruleFn_iterationMissingFields: function(r) {
        var missingFields = [];

        _.each(this.requiredFields, function (f) {
            if (!r.get(f) && r.getField(f)) {
                var name = r.getField(f).displayName;
                missingFields.push(name);
            }
        });
        if (missingFields.length === 0) {
            return null;
        }
        return {
            rule: 'ruleFn_iterationMissingFields',
            text: Ext.String.format('<li>Iteration fields Missing: {0}', missingFields.join(','))
        };
    }
});

