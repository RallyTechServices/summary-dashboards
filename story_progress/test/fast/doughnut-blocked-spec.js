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
        
        var story_data = series[0];
        expect(story_data[0].name).toEqual('US1');
        expect(story_data[0].y).toEqual(10);
        expect(story_data[0].color).toEqual('red');
        
        var task_data = series[1];
        expect(task_data[0].name).toEqual('TA1');
        expect(task_data[0].y).toEqual(5);
        expect(task_data[0].color).toEqual('hsla(235,100%,40%,1)');
        expect(task_data[1].name).toEqual('TA2');
        expect(task_data[1].y).toEqual(5);
        expect(task_data[1].color).toEqual('red');
        
    });
    
});
