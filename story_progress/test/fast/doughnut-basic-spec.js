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
            { name: 'US1', y: 13, color: 'hsla(235,100%,40%,1)', idx: 0 }
        ]);
        expect(series[1]).toEqual([
            { name: 'TA37', y: 13, color: 'hsla(235,100%,40%,1)' }
        ]);
        
    });
    
    it("should return series when stories than colors",function(){
        var colors = [1,2,3];
        donut.colors = colors;
        
        var story =  Ext.create('mockStory',{ FormattedID: 'US1'});
        var story1 = Ext.create('mockStory',{ FormattedID: 'US2'});
        var story2 = Ext.create('mockStory',{ FormattedID: 'US3'});
        var story3 = Ext.create('mockStory',{ FormattedID: 'US4'});
        var story4 = Ext.create('mockStory',{ FormattedID: 'US5'});
        var story5 = Ext.create('mockStory',{ FormattedID: 'US6'});
        var story6 = Ext.create('mockStory',{ FormattedID: 'US7'});
        
        donut.inside_records = [story,story1,story2,story3,story4,story5,story6];
        
        var series = donut.calculateSlices();
        var points = series[0];
        expect(points[0].color).toEqual( 'hsla(1,100%,40%,1)');
        expect(points[1].color).toEqual( 'hsla(2,100%,40%,1)');
        expect(points[2].color).toEqual( 'hsla(3,100%,40%,1)');
        expect(points[3].color).toEqual( 'hsla(1,100%,40%,1)');
        expect(points[4].color).toEqual( 'hsla(2,100%,40%,1)');
        expect(points[5].color).toEqual( 'hsla(3,100%,40%,1)');
        expect(points[6].color).toEqual( 'hsla(1,100%,40%,1)');
        
        
    });
    
    
    it("should return series when 1 story with 2 equal tasks",function(){
        var story = Ext.create('mockStory',{ PlanEstimate: 10 });
        var task  = Ext.create('mockTask', { FormattedID: 'TA1', Estimate: 2, WorkProduct: story.getData() });
        var task2  = Ext.create('mockTask', { FormattedID: 'TA2', Estimate: 2, WorkProduct: story.getData() });
        
        donut.inside_records = [story];
        donut.outside_records = [task,task2];
        
        var series = donut.calculateSlices();
        
        var story_data = series[0];
        expect(story_data[0].name).toEqual('US1');
        expect(story_data[0].y).toEqual(10);
        expect(story_data[0].color).toEqual('hsla(235,100%,40%,1)');
        
        var task_data = series[1];
        expect(task_data[0].name).toEqual('TA1');
        expect(task_data[0].y).toEqual(5);
        expect(task_data[0].color).toEqual('hsla(235,100%,40%,1)');
        expect(task_data[1].name).toEqual('TA2');
        expect(task_data[1].y).toEqual(5);
        expect(task_data[1].color).toEqual('hsla(235,100%,40%,1)');        

    });
    
    it("should return series when 1 story with 2 unequal tasks",function(){
        var story = Ext.create('mockStory',{ PlanEstimate: 10 });
        var task  = Ext.create('mockTask', { FormattedID: 'TA1', Estimate: 2, WorkProduct: story.getData() });
        var task2  = Ext.create('mockTask', { FormattedID: 'TA2', Estimate: 3, WorkProduct: story.getData() });
        
        donut.inside_records = [story];
        donut.outside_records = [task,task2];
        
        var series = donut.calculateSlices();
        var story_data = series[0];
        expect(story_data[0].name).toEqual('US1');
        expect(story_data[0].y).toEqual(10);
        expect(story_data[0].color).toEqual('hsla(235,100%,40%,1)');
        
        var task_data = series[1];
        expect(task_data[0].name).toEqual('TA1');
        expect(task_data[0].y).toEqual(4);
        expect(task_data[0].color).toEqual('hsla(235,100%,40%,1)');
        expect(task_data[1].name).toEqual('TA2');
        expect(task_data[1].y).toEqual(6);
        expect(task_data[1].color).toEqual('hsla(235,100%,40%,1)'); 
       
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
        var story_data = series[0];
        expect(story_data[0].name).toEqual('US1');
        expect(story_data[0].y).toEqual(10);
        expect(story_data[0].color).toEqual('hsla(235,100%,40%,1)');
        expect(story_data[1].name).toEqual('US2');
        expect(story_data[1].y).toEqual(10);
        expect(story_data[1].color).toEqual('hsla(20,100%,40%,1)');
        
        var task_data = series[1];
        expect(task_data[0].name).toEqual('TA1');
        expect(task_data[0].y).toEqual(5);
        expect(task_data[0].color).toEqual('hsla(235,100%,40%,1)');
        expect(task_data[1].name).toEqual('TA2');
        expect(task_data[1].y).toEqual(5);
        expect(task_data[1].color).toEqual('hsla(235,100%,40%,1)'); 
        expect(task_data[2].name).toEqual('TA3');
        expect(task_data[2].y).toEqual(5);
        expect(task_data[2].color).toEqual('hsla(20,100%,40%,1)');         
        expect(task_data[3].name).toEqual('TA4');
        expect(task_data[3].y).toEqual(5);
        expect(task_data[3].color).toEqual('hsla(20,100%,40%,1)'); 

    });
    
    it("should set task colors by state",function(){
        var story = Ext.create('mockStory',{ FormattedID: 'US1', PlanEstimate: 9 });
        var task  = Ext.create('mockTask', { FormattedID: 'TA1', Estimate: 2, WorkProduct: story.getData(), State: "Defined" });
        var task2  = Ext.create('mockTask', { FormattedID: 'TA2', Estimate: 2, WorkProduct: story.getData(), State: "In-Progress"});
        var task3  = Ext.create('mockTask', { FormattedID: 'TA3', Estimate: 2, WorkProduct: story.getData(), State: "Completed" });
        
        donut.inside_records = [story];
        donut.outside_records = [task,task2,task3];
        
        var series = donut.calculateSlices();
        
        var story_data = series[0];
        expect(story_data[0].name).toEqual('US1');
        expect(story_data[0].y).toEqual(9);
        expect(story_data[0].color).toEqual('hsla(235,100%,40%,1)');
        
        var task_data = series[1];
        expect(task_data[0].name).toEqual('TA1');
        expect(task_data[0].y).toEqual(3);
        expect(task_data[0].color).toEqual('hsla(235,100%,40%,1)');
        expect(task_data[1].name).toEqual('TA2');
        expect(task_data[1].y).toEqual(3);
        expect(task_data[1].color).toEqual('hsla(235,100%,60%,1)');
        expect(task_data[2].name).toEqual('TA3');
        expect(task_data[2].y).toEqual(3);
        expect(task_data[2].color).toEqual('hsla(235,100%,80%,1)');
         
    });
});
