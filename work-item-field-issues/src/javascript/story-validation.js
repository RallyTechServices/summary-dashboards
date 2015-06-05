Ext.define('Rally.technicalservices.UserStoryValidationRules',{
    extend: 'Rally.technicalservices.ValidationRules',
    //ruleFnPrefix: 'ruleFn_',
    requiredFields: undefined, //

    constructor: function(config){
        Ext.apply(this, config);
        this.requiredFields = ['Owner','PlanEstimate'];
    },
    ruleFn_unscheduledIterationScheduleState: function(r){
        /**
         * If Iteration = unscheduled and state In-Progress raise flag
         */
        if (!r.get('Iteration') && r.get('ScheduleState') != 'Defined'){
            return Ext.String.format('{0} is an invalid state for an unscheduled Iteration', r.get('ScheduleState'));
        }
        return null;
    },
    ruleFn_blockedNotInProgress: function(r){
        /**
         * Story is blocked, schedulestate must be In-Progress
         */
        if (r.get('Blocked')){
            if (r.get('ScheduleState') != 'In-Progress'){
                return Ext.String.format('<li>Invalid State ({0}) for blocked story', r.get('ScheduleState'));
            }
        }
        return null;
    },
    ruleFn_storyMissingFields: function(r) {
        var missingFields = [];

        _.each(this.requiredFields, function (f) {
            if (!r.get(f)) {
                var name = r.getField(f).displayName;
                missingFields.push(name);
            }
        });
        if (missingFields.length === 0) {
            return null;
        }
        return Ext.String.format('<li>Missing fields: {0}', missingFields.join(','));
    },
    ruleFn_storyHasNoFeature: function(r){
        if (!r.get('Feature')){
            return '<li>Story is not associated with a Feature.';
        }
        return null;
    },
    ruleFn_storyHasIterationWithoutRelease: function(r){
        if (!r.get('Release') && r.get('Iteration')){
            return Ext.String.format('<li>Story is scheduled in Iteration [{0}] without a Release.', r.get('Iteration').Name);
        }
        return null;
    },
    ruleFn_storyBlockedWithoutReason: function(r){
        if (r.get('Blocked') && !r.get('BlockedReason')){
            return '<li>Story is blocked without a reason.';
        }
        return null;
    },
    ruleFn_storyRelaseDoesNotMatchFeatureRelease: function(r){
        return null;
    }
});

