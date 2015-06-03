describe("When given a set of stories and tasks", function() {
    var donut;
    
    beforeEach(function(){
        donut = Ext.create('Rally.technicalservices.DoughnutPie',{ });
    });
    
    it("should return series when 1 story with 1 task",function(){
        var story = Ext.create('mockStory',{});
        var task  = Ext.create('mockTask', { WorkProduct: story.getData() });
        
        donut.inside_records = [story];
        donut.outside_records = [task];
        
        var series = donut.calculateSlices();
        expect(series[0]).toEqual([
            { name: 'US1', y: 13, color: 'blue' }
        ]);
        expect(series[1]).toEqual([
            { name: 'TA37', y: 13, color: 'blue' }
        ]);
        
    });
    
    it("should return series when 1 story with 2 equal tasks",function(){
        var story = Ext.create('mockStory',{ PlanEstimate: 10 });
        var task  = Ext.create('mockTask', { FormattedID: 'TA1', Estimate: 2, WorkProduct: story.getData() });
        var task2  = Ext.create('mockTask', { FormattedID: 'TA2', Estimate: 2, WorkProduct: story.getData() });
        
        donut.inside_records = [story];
        donut.outside_records = [task,task2];
        
        var series = donut.calculateSlices();
        expect(series[0]).toEqual([
            { name: 'US1', y: 10, color: 'blue' }
        ]);
        expect(series[1]).toEqual([
            { name: 'TA1', y: 5, color: 'blue' },
            { name: 'TA2', y: 5, color: 'blue' }
        ]);
        
    });
    
    it("should return series when 1 story with 2 unequal tasks",function(){
        var story = Ext.create('mockStory',{ PlanEstimate: 10 });
        var task  = Ext.create('mockTask', { FormattedID: 'TA1', Estimate: 2, WorkProduct: story.getData() });
        var task2  = Ext.create('mockTask', { FormattedID: 'TA2', Estimate: 3, WorkProduct: story.getData() });
        
        donut.inside_records = [story];
        donut.outside_records = [task,task2];
        
        var series = donut.calculateSlices();
        expect(series[0]).toEqual([
            { name: 'US1', y: 10, color: 'blue' }
        ]);
        expect(series[1]).toEqual([
            { name: 'TA1', y: 4, color: 'blue' },
            { name: 'TA2', y: 6, color: 'blue' }
        ]);
        
    });
    
    it("should return series when 2 stories with 2 equal tasks",function(){
        var story = Ext.create('mockStory',{ FormattedID: 'US1', PlanEstimate: 10 });
        var story2 = Ext.create('mockStory',{ FormattedID: 'US2', PlanEstimate: 10 });
        var task  = Ext.create('mockTask', { FormattedID: 'TA1', Estimate: 2, WorkProduct: story.getData() });
        var task2  = Ext.create('mockTask', { FormattedID: 'TA2', Estimate: 2, WorkProduct: story.getData() });
        var task3  = Ext.create('mockTask', { FormattedID: 'TA3', Estimate: 2, WorkProduct: story2.getData() });
        var task4  = Ext.create('mockTask', { FormattedID: 'TA4', Estimate: 2, WorkProduct: story2.getData() });
        
        donut.inside_records = [story,story2];
        donut.outside_records = [task,task2,task3,task4];
        
        var series = donut.calculateSlices();
        expect(series[0]).toEqual([
            { name: 'US1', y: 10, color: 'blue' },
            { name: 'US2', y: 10, color: 'blue' }
        ]);
        expect(series[1]).toEqual([
            { name: 'TA1', y: 5, color: 'blue' },
            { name: 'TA2', y: 5, color: 'blue' },
            { name: 'TA3', y: 5, color: 'blue' },
            { name: 'TA4', y: 5, color: 'blue' }
        ]);
        
    });
});
