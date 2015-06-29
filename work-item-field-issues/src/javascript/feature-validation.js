Ext.define('Rally.technicalservices.FeatureValidationRules',{
    extend: 'Rally.technicalservices.ValidationRules',

    requiredFields: undefined,
    stories: undefined,

    constructor: function(config){
        Ext.apply(this, config);
        this.requiredFields = ['Owner','State','c_ValueMetricKPI'];

    },
    ruleFn_featureRiskDescription: function(r){
        if (r.get('c_Risk') && !r.get('c_RiskDescription')){
            return {
                rule: 'ruleFn_featureRiskDescription',
                text: '<li>Feature Risk has no Description.'
            };
        }
        return null;
    },
    ruleFn_isProgramRisk: function(r){
        if (r.get('c_Risk') && !r.get('Parent') && r.get('LeafStoryCount') == 0){
            return {
                rule: 'ruleFn_isProgramRisk',
                text: '<li>Feature is program level risk',
                stopProcessing: true
            };
        }
        return null;
    },
    ruleFn_noStoriesForFeature: function(r){

        if (this.ruleFn_isProgramRisk(r) == null) {
            if (r.get('LeafStoryCount') == 0) {
                return {
                    rule: 'ruleFn_noStoriesForFeature',
                    text: Ext.String.format('<li>Feature has no stories.')
                };
            }
        }
        return null;
    },
    ruleFn_featureHasNoPoints: function(r){
        if (r.get('LeafStoryCount') > 0 && r.get('LeafStoryPlanEstimateTotal')==0){
            return {
                rule: 'ruleFn_featureHasNoPoints',
                text: '<li>Feature has no points.'
            }
        }
        return null;
    },
    ruleFn_FeatureDateIssue: function(r){

        if (this.ruleFn_isProgramRisk(r) == null) {
            var planned_start = r.get('PlannedStartDate');

            if (!r.get('ActualStartDate')){
                if (planned_start) {
                    if (Rally.util.DateTime.fromIsoString(planned_start) <= new Date()){
                        return {
                            rule: 'ruleFn_FeatureDateIssue',
                            text: Ext.String.format('<li>Feature Date Issue:  Feature not started when planned')
                        };
                    }
                } else {
                    return {
                        rule: 'ruleFn_FeatureDateIssue',
                        text: Ext.String.format('<li>Feature Date Issue:  Feature has no PlannedStartDate')
                    };
                }
            }

            var planned_end = r.get('PlannedEndDate');

            if (!r.get('ActualEndDate')){
                if (planned_end) {
                    if (Rally.util.DateTime.fromIsoString(planned_end) <= new Date()){
                        return {
                            rule: 'ruleFn_FeatureDateIssue',
                            text: Ext.String.format('<li>Feature Date Issue:  Feature was not completed on its planned end date.')
                        };
                    }
                } else {
                    return {
                        rule: 'ruleFn_FeatureDateIssue',
                        text: Ext.String.format('<li>Feature Date Issue:  Feature has no PlannedEndDate')
                    };
                }
            }
        }
        return null;
    },
    //ruleFn_FeatureHasNotBeenStarted: function(r){
    //    if (!r.get('ActualStartDate')){
    //        return Ext.String.format('<li>Feature has not started.');
    //    }
    //    return null;
    //},
    //ruleFn_featureHasNotBeenCompleted: function(r){
    //    if (!r.get('ActualEndDate')){
    //        return Ext.String.format('<li>Feature not completed.');
    //    }
    //    return null;
    //},
    ruleFn_featureMissingFields: function(r) {
        if (this.ruleFn_isProgramRisk(r) == null) {
            var missingFields = [];

            _.each(this.requiredFields, function (f) {
                if (!r.get(f)) {
                    var name = r.getField(f) ? r.getField(f).displayName : f;
                    missingFields.push(name);
                }
            });
            if (missingFields.length === 0) {
                return null;
            }
            return {
                rule: 'ruleFn_featureMissingFields',
                text: Ext.String.format('<li>Feature fields Missing: {0}', missingFields.join(','))
            };
        }
        return null;
    },
    ruleFn_FeatureHasNoParent: function(r) {
        if (this.ruleFn_isProgramRisk(r) == null && !r.get('Parent')) {
            return {
                rule: 'ruleFn_FeatureHasNoParent',
                text: Ext.String.format('<li>Feature has no parent.')
            };
        }
        return null;
    }
});
