Ext.define('Rally.technicalservices.ValidationRules',{

    ruleFnPrefix: 'ruleFn_',
    requiredFields: undefined,

    constructor: function(config){
        Ext.apply(this, config);
    },

    getRules: function(){
        var ruleFns = [],
            ruleRe = new RegExp('^' + this.ruleFnPrefix);

        for (var fn in this)
        {
            if (ruleRe.test(fn)){
                ruleFns.push(fn);
            }
        }
        return ruleFns;
    },
    ruleFn_missingFields: function(r) {
        var missingFields = [];

        _.each(this.requiredFields, function (f) {
            if (!r.get(f)) {
                missingFields.push(f);
            }
        });
        if (missingFields.length === 0) {
            return null;
        }
        return Ext.String.format('Missing fields: {0}', missingFields.join(','));
    },

    statics: {
        getUserFriendlyRuleLabel: function(ruleName){
            switch(ruleName){
                case 'ruleFn_missingFields':
                    return 'Required Fields are missing';

                case 'ruleFn_stateSynchronization':
                    return '[Feature] State is not aligned with story states';

                case 'ruleFn_featureTargetSprintMatchesRelease':
                    return '[Feature] Target Sprint not aligned with Release';

                case 'ruleFn_storiesPlannedByFeatureTargetSprint':
                    return '[Feature] child stories are planned after Feature Target Sprint';

                case 'ruleFn_featureStateShouldMatchTargetSprint':
                    return '[Feature] State not aligned with Target Sprint';

                case 'ruleFn_unscheduledIterationScheduleState':
                    return '[User Story] is In-Progress with unscheduled Iteration';

                case 'ruleFn_blockedFieldsPopulated':
                    return '[User Story] Blocked fields not populated';

                case 'ruleFn_blockedNotInProgress':
                    return '[User Story] is Blocked but not In-Progress';

                case 'ruleFn_sprintCompleteNotAccepted':
                    return '[User Story] in past Iteration not complete';
            }
            return ruleName;
        }
    }
});