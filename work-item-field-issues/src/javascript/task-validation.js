Ext.define('Rally.technicalservices.TaskValidationRules',{
    extend: 'Rally.technicalservices.ValidationRules',
    //ruleFnPrefix: 'ruleFn_',
    requiredFields: ['Owner'], //

    constructor: function(config){
        Ext.apply(this, config);
    },
    ruleFn_taskMissingFields: function(r) {
        // force FormattedID so it shows in the left column
        r.set('FormattedID', r.get('Name'));
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
        return Ext.String.format('<li>Task fields Missing: {0}', missingFields.join(','));
    }
});

