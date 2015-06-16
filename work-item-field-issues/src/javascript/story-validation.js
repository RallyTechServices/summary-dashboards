Ext.define('Rally.technicalservices.UserStoryValidationRules',{
    extend: 'Rally.technicalservices.ValidationRules',
    //ruleFnPrefix: 'ruleFn_',
    requiredFields: undefined, //
    features: undefined,
    orderedScheduleStates: undefined,
    definedScheduleStateIndex: undefined,

    constructor: function(config){
        Ext.apply(this, config);
        this.requiredFields = ['Owner','PlanEstimate'];
        console.log('schedulestates', this.orderedScheduleStates, this.definedScheduleStateIndex);
    },
    ruleFn_unscheduledIterationScheduleState: function(r){
        /**
         * If Iteration = unscheduled and state In-Progress raise flag
         */
        var scheduleStateIdx = _.indexOf(this.orderedScheduleStates, r.get('ScheduleState'));

        if (!r.get('Iteration') && scheduleStateIdx > this.definedScheduleStateIndex){
            return Ext.String.format('<li>{0} is an invalid state for an unscheduled Iteration', r.get('ScheduleState'));
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
            if (!r.get(f) && r.getField(f)) {
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
    ruleFn_storyPlanEstimate: function(r){
        if (r.get('PlanEstimate')==0){
            return '<li>Story Plan Estimate is 0';
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
        console.log('blocked',r.get('FormattedID'), r.get('Blocked'), r.get('BlockedReason'), r.get('Blocker'));
        if (r.get('Blocked') && !r.get('BlockedReason')){
            if (r.get('Blocker')){
                console.log('blocker', r.get('Blocker'));
                return '<li>Story is blocked without reason.  Verify descendant artifact has a reason.';
            } else {
                return '<li>Story is blocked without a reason.';
            }
        }
        return null;
    },
    ruleFn_storyRelaseDoesNotMatchFeatureRelease: function(r){
        var msg = null;

        var release = r.get('Release');
        if (r.get('Feature') && release){

            if (!r.get('Feature').Release || r.get('Feature').Release.Name != release.Name ||
                r.get('Feature').Release.ReleaseStartDate != release.ReleaseStartDate ||
                r.get('Feature').Release.ReleaseDate != release.ReleaseDate){
                msg = '<li>Story\'s release does not match parent Feature\'s release';
            }

        }
        return msg;
    },
    ruleFn_storyRiskDescription: function(r){
        if (r.get('c_Risk') && !r.get('c_RiskDescription')){
            return '<li>Story flagged as Risk has no Risk description.'
        }
        return null;
    }
});

