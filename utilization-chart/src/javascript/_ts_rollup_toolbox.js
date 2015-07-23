Ext.define('Rally.technicalservices.RollupToolbox',{
    singleton: true,
    rollUpData: function(iterations) {

        var logger = new Rally.technicalservices.Logger(),
            leaves = Ext.Array.filter(iterations, function(iteration){
            var project = iteration.get('Project');
            if ( project && project.Children && project.Children.Count == 0 && project.Parent ) {
                return true;
            }
            return false;
        });
        logger.log("Leaf project iterations: ", leaves);

        var project_iteration_hash = {};
        Ext.Array.each(iterations, function(iteration) {
            var project = iteration.get('Project');
            if (Ext.isEmpty(project_iteration_hash[project.ObjectID])){
                project_iteration_hash[project.ObjectID] = {};
            }
            project_iteration_hash[project.ObjectID][iteration.get('Name')] = iteration;
        },this);

        logger.log('project_iteration_hash', project_iteration_hash);
        while ( leaves.length > 0 ) {
            var parent_iterations = [];

            Ext.Array.each(leaves, function(leaf) {
                var iteration_name = leaf.get('Name'),
                    parent_project = leaf.get('Project').Parent;

                    if (parent_project && project_iteration_hash[parent_project.ObjectID] && project_iteration_hash[parent_project.ObjectID][iteration_name]){

                        var parent_iteration = project_iteration_hash[parent_project.ObjectID][iteration_name];
                        parent_iterations = Ext.Array.merge(parent_iterations, [parent_iteration]);

                        this._setValuesForParent(leaf,parent_iteration,'PlannedVelocity');
                        this._setValuesForParent(leaf,parent_iteration,'__startScope');
                        this._setValuesForParent(leaf,parent_iteration,'__endScope');
                        this._setValuesForParent(leaf,parent_iteration,'__endAcceptance');

                        this._setArrayValuesForParent(leaf,parent_iteration,'__dailyScope');
                        this._setArrayValuesForParent(leaf,parent_iteration,'__dailyAcceptance');
                }
            },this);
            logger.log('parents:', parent_iterations);
            leaves = parent_iterations;
        }
        return iterations;
    },

    _setArrayValuesForParent: function(leaf, parent,rollup_field) {
        if (! parent ) {
            return null;
        }

        var parent_values = parent.get(rollup_field) || [],
            leaf_values = leaf.get(rollup_field) || [],
            new_values = [];

        Ext.Array.each(leaf_values, function(leaf_value,idx){
            var value = leaf_value || 0;
            if ( idx < parent_values.length ) {
                var parent_value = parent_values[idx] || 0;
                new_values.push(value + parent_value);
            } else {
                new_values.push(leaf_value);
            }
        });
        parent.set(rollup_field, new_values);

        return parent;
    },

    _setValuesForParent: function(leaf,leaf_parent,field) {
        if (! leaf_parent) {
            return null;
        }

        var parent_value = leaf_parent.get(field) || 0;
        var leaf_value = leaf.get(field) || 0;

        leaf_parent.set(field, parent_value + leaf_value);
        return leaf_parent;
    }
});
