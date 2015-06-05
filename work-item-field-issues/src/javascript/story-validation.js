Ext.define('Rally.technicalservices.UserStoryValidationRules',{
    extend: 'Rally.technicalservices.ValidationRules',
    //ruleFnPrefix: 'ruleFn_',
    requiredFields: undefined, //

    constructor: function(config){
        Ext.apply(this, config);
        this.requiredFields = ['Owner','Feature','PlanEstimate'];
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
                return Ext.String.format('Invalid State ({0}) for blocked story', r.get('ScheduleState'));
            }
        }
        return null;
    }
});

