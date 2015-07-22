describe("When rolling up iteration data for projects", function() {

    var iteration_start_date_1 = new Date(2015,06,02),
        iteration_end_date_1 = new Date(2015,06,05);

    var iterations = [
        Ext.create("mockIteration",{
        'ObjectID': 1,
        Name: 'Iteration 1',
        StartDate: iteration_start_date_1,
        EndDate: iteration_end_date_1,
        Project: {Name: "P1", ObjectID: 1, Parent: null, Children: {Count: 2}},
        PlannedVelocity: 1,
        __startScope: 1,
        __endScope: 1,
        __endAcceptance: 1,
        __dailyScope: [1,1,1],
        __dailyAcceptance: [1,1,1]
    }),
        Ext.create("mockIteration",{
        'ObjectID': 2,
        Name: 'Iteration 1',
        StartDate: iteration_start_date_1,
        EndDate: iteration_end_date_1,
        Project: {Name: "P1.1", ObjectID: 2, Parent: {ObjectID: 1},  Children: {Count: 0}},
        PlannedVelocity: 1,
        __startScope: 1,
        __endScope: 1,
        __endAcceptance: 1,
        __dailyScope: [1,1,1],
        __dailyAcceptance: [1,1,1]
    }),
        Ext.create("mockIteration",{
        'ObjectID': 3,
        Name: 'Iteration 1',
        StartDate: iteration_start_date_1,
        EndDate: iteration_end_date_1,
        Project: {Name: "P1.2", ObjectID: 3, Parent: {ObjectID: 1},  Children: {Count: 2}},
        PlannedVelocity: 1,
        __startScope: 1,
        __endScope: 1,
        __endAcceptance: 1,
        __dailyScope: [1,1,1],
        __dailyAcceptance: [1,1,1]
    }),
        Ext.create("mockIteration",{
            'ObjectID': 4,
            Name: 'Iteration 1',
            StartDate: iteration_start_date_1,
            EndDate: iteration_end_date_1,
            Project: {Name: "P1.2.1", ObjectID: 4, Parent: {ObjectID: 3}, Children: {Count: 0}},
            PlannedVelocity: 1,
            __startScope: 1,
            __endScope: 1,
            __endAcceptance: 1,
            __dailyScope: [1,1,1],
            __dailyAcceptance: [1,1,1]
        }),
        Ext.create("mockIteration",{
            'ObjectID': 5,
            Name: 'Iteration 1',
            StartDate: iteration_start_date_1,
            EndDate: iteration_end_date_1,
            Project: {Name: "P1.2.2", ObjectID: 5, Parent: {ObjectID: 3}, Children: {Count: 0}},
            PlannedVelocity: 1,
            __startScope: 1,
            __endScope: 1,
            __endAcceptance: 1,
            __dailyScope: [1,1,1],
            __dailyAcceptance: [1,1,1]
        })];

    it("should add up correctly",function(){

        expect(iterations[0].get('PlannedVelocity')).toBe(1);
        expect(iterations[1].get('PlannedVelocity')).toBe(1);
        expect(iterations[2].get('PlannedVelocity')).toBe(1);
        expect(iterations[3].get('PlannedVelocity')).toBe(1);
        expect(iterations[4].get('PlannedVelocity')).toBe(1);

        Rally.technicalservices.RollupToolbox.rollUpData(iterations);

         expect(iterations[0].get('PlannedVelocity')).toBe(5);
         expect(iterations[1].get('PlannedVelocity')).toBe(1);
         expect(iterations[2].get('PlannedVelocity')).toBe(3);
         expect(iterations[3].get('PlannedVelocity')).toBe(1);
         expect(iterations[4].get('PlannedVelocity')).toBe(1);
    });
    
});
