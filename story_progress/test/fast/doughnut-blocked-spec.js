describe("When given a set of stories and tasks", function() {
    var donut;
    
    beforeEach(function(){
        donut = Ext.create('Rally.technicalservices.DoughnutPie',{ });
    });
    
    it("should return series when 1 story with 2 tasks, 1 blocked",function(){
        var story = Ext.create('mockStory',{ PlanEstimate: 10, Blocked: true });
        var task  = Ext.create('mockTask', { FormattedID: 'TA1', Estimate: 2, WorkProduct: story.getData() });
        var task2  = Ext.create('mockTask', { FormattedID: 'TA2', Estimate: 2, WorkProduct: story.getData(), Blocked: true });
        
        donut.inside_records = [story];
        donut.outside_records = [task,task2];
        
        var series = donut.calculateSlices();
        expect(series[0]).toEqual([
            { name: 'US1', y: 10, color: 'red' }
        ]);
        expect(series[1]).toEqual([
            { name: 'TA1', y: 5, color: 'blue' },
            { name: 'TA2', y: 5, color: 'red' }
        ]);
        
    });
    
});
