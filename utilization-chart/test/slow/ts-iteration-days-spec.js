describe("When calculating days for a ts sprint", function() {
    var model;
    var iteration;
    var ready_to_test;

    // 13 July 2015
    var monday_morning = new Date(2015,06,13,0,0,0);
    var monday_evening = new Date(2015,06,13,23,59,59);
    
    var tuesday_evening = new Date(2015,06,14,23,59,59);
    var wednesday_evening = new Date(2015,06,15,23,59,59);
    var thursday_evening = new Date(2015,06,16,23,59,59);
    // 17 July 2015
    var friday_morning = new Date(2015,06,17,0,0,0);
    var friday_evening = new Date(2015,06,17,23,59,59);
    
        
    beforeEach(function(){
        model = null;
        ready_to_test = false;
    });
    
    it("should populate __days with a value for each end-of-day for the iteration",function(){
        runs(function(){
            Rally.technicalservices.ModelBuilder.build('Iteration','tsIteration',[]).then({
                success: function(result) {
                    model = result;
                    iteration = Ext.create(model,{
                        'StartDate': monday_morning,
                        'EndDate': friday_evening
                    });
                    ready_to_test = true;
                },
                failure: function(msg) {
                    flag = true;
                    console.log('msg',msg);
                }
            });
        });
        
        waitsFor(function() {
            return ready_to_test;
        }, "Asynchronous call done");
        
        
        runs (function(){
            expect(iteration.get('StartDate')).toEqual(monday_morning);
            expect(iteration.get('__days').length).toEqual(5);
            expect(iteration.get('__days')).toEqual([
                monday_evening,
                tuesday_evening,
                wednesday_evening,
                thursday_evening,
                friday_evening
            ]);
        });
    });
    
    it("should populate __days with a single value an iteration starting/ending on same day",function(){
        runs(function(){
            Rally.technicalservices.ModelBuilder.build('Iteration','tsIteration',[]).then({
                success: function(result) {
                    model = result;
                    iteration = Ext.create(model,{
                        'StartDate': monday_morning,
                        'EndDate': monday_evening
                    });
                    ready_to_test = true;
                },
                failure: function(msg) {
                    flag = true;
                    console.log('msg',msg);
                }
            });
        });
        
        waitsFor(function() {
            return ready_to_test;
        }, "Asynchronous call done");
        
        
        runs (function(){
            expect(iteration.get('__days').length).toEqual(1);
            expect(iteration.get('__days')).toEqual([
                monday_evening
            ]);
        });
    });    
});
