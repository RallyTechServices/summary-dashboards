describe("When given a set of stories and tasks that have missing data", function() {
    var donut;
    
    beforeEach(function(){
        donut = Ext.create('Rally.technicalservices.DoughnutPie',{ });
    });
    
    it("should return series when 1 story with no tasks",function(){
        var story = Ext.create('mockStory',{});
        
        donut.inside_records = [story];
        
        var series = donut.calculateSlices();
        expect(series[0]).toEqual([
            { name: 'US1', y: 13, color: 'blue' }
        ]);
        expect(series[1]).toEqual([
            { name: 'none', y: 13, color: 'white' }
        ]);
        
    });
    
    it("should return series when 1 story with 2 tasks, one is empty",function(){
        var story = Ext.create('mockStory',{ PlanEstimate: 10 });
        var task  = Ext.create('mockTask', { FormattedID: 'TA1', Estimate: 2, WorkProduct: story.getData() });
        var task2  = Ext.create('mockTask', { FormattedID: 'TA2', Estimate: 0, WorkProduct: story.getData() });
        
        donut.inside_records = [story];
        donut.outside_records = [task,task2];
        
        var series = donut.calculateSlices();
        expect(series[0]).toEqual([
            { name: 'US1', y: 10, color: 'blue' }
        ]);
        expect(series[1]).toEqual([
            { name: 'TA1', y: 10, color: 'blue' },
            { name: 'TA2', y: 0, color: 'blue' }
        ]);
        
    });
    
    it("should return series when 2 stories, one story has no tasks",function(){
        var story = Ext.create('mockStory',{ FormattedID: 'US1', PlanEstimate: 10 });
        var story2 = Ext.create('mockStory',{ FormattedID: 'US2', PlanEstimate: 10 });
        var task  = Ext.create('mockTask', { FormattedID: 'TA1', Estimate: 2, WorkProduct: story.getData() });
        var task2  = Ext.create('mockTask', { FormattedID: 'TA2', Estimate: 2, WorkProduct: story.getData() });
        
        donut.inside_records = [story,story2];
        donut.outside_records = [task,task2];
        
        var series = donut.calculateSlices();
        expect(series[0]).toEqual([
            { name: 'US1', y: 10, color: 'blue' },
            { name: 'US2', y: 10, color: 'blue' }
        ]);
        expect(series[1]).toEqual([
            { name: 'TA1', y: 5, color: 'blue' },
            { name: 'TA2', y: 5, color: 'blue' },
            { name: 'none', y: 10, color: 'white' }
        ]);
        
    });
});
