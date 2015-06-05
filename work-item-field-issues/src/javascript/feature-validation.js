Ext.define('Rally.technicalservices.FeatureValidationRules',{
    extend: 'Rally.technicalservices.ValidationRules',

    requiredFields: undefined,
    iterations: [],
    stories: [],

    constructor: function(config){
        Ext.apply(this, config);
        this.requiredFields = ['Owner','PlannedEndDate','PlannedStartDate','State'];

    },
    //ruleFn_stateSynchronization: function(r) {
    //    /**
    //     * State == Done,
    //     * then all user stories should be accepted
    //     * AND
    //     * if All user stories == Accepted,
    //     * State should be Done
    //     */
    //
    //    var featureDone = r.get('State') ? r.get('State').Name === 'Done' : false ,
    //        storiesAccepted = r.get('AcceptedLeafStoryCount') === r.get('LeafStoryCount');
    //
    //    if (featureDone === storiesAccepted){
    //        return null;
    //    }
    //    if (featureDone){
    //        return Ext.String.format('Feature is Done but not all stories are accepted ({0} of {1} accepted)', r.get('AcceptedLeafStoryCount'), r.get('LeafStoryCount'));
    //    }
    //    return Ext.String.format('Feature state ({0}) should be Done because all stories are accepted.', r.get('State').Name);
    //},
    ruleFn_featureRule2: function(r){
        /**
         * FTS == R4.xxx,
         * and R4.xxx == iteration (R4.xxx),
         * and iteration (R4.xxx) == done, then
         * FTS.State should be Done
         */
        return null;
    }
});
