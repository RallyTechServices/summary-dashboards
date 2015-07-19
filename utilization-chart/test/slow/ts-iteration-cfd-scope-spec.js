describe("When using an extended model and setting cfd", function() {
    var model;
    var iteration;
    var ready_to_test;

    // 13 July 2015
    var monday_morning = new Date(2015,06,13,0,0,0);
    var monday_evening = new Date(2015,06,13,23,59,59);
    
    var tuesday_morning = new Date(2015,06,14,0,0,0);
    var tuesday_evening = new Date(2015,06,14,23,59,59);
    
    var wednesday_morning = new Date(2015,06,15,0,0,0);
    var wednesday_evening = new Date(2015,06,15,23,59,59);

    var thursday_evening = new Date(2015,06,16,23,59,59);
    // 17 July 2015
    var friday_morning = new Date(2015,06,17,0,0,0);
    var friday_evening = new Date(2015,06,17,23,59,59);
    
    
    var cfd_monday = [
        Ext.create('mockCFD', {
            'CardEstimateTotal': 1,
            'CardState':'Defined',
            'CreationDate': monday_morning,
            'IterationObjectID':7
        }),
        Ext.create('mockCFD', {
            'CardEstimateTotal': 3,
            'CardState':'Accepted',
            'CreationDate': monday_morning,
            'IterationObjectID':7
        })
    ];
    
    var cfd_monday_other_oid = [
        Ext.create('mockCFD', {
            'CardEstimateTotal': 1,
            'CardState':'Defined',
            'CreationDate': monday_morning,
            'IterationObjectID':8
        }),
        Ext.create('mockCFD', {
            'CardEstimateTotal': 3,
            'CardState':'Accepted',
            'CreationDate': monday_morning,
            'IterationObjectID':8
        })
    ];
    
    var cfd_tuesday = [
        Ext.create('mockCFD', {
            'CardEstimateTotal': 2,
            'CardState':'Defined',
            'CreationDate': tuesday_morning
        }),
        Ext.create('mockCFD', {
            'CardEstimateTotal': 4,
            'CardState':'Accepted',
            'CreationDate': tuesday_morning
        })
    ];
    
    
    var cfd_wednesday = [
        Ext.create('mockCFD', {
            'CardEstimateTotal': 1,
            'CardState':'Defined',
            'CreationDate': wednesday_morning
        }),
        Ext.create('mockCFD', {
            'CardEstimateTotal': 5,
            'CardState':'Accepted',
            'CreationDate': wednesday_morning
        })
    ];
    
    beforeEach(function(){
        model = null;
        ready_to_test = false;
    });
    
    it("should populate __scope with a total plan estimate each day ignoring wrong days",function(){
        runs(function(){
            Rally.technicalservices.ModelBuilder.build('Iteration','tsIteration',[]).then({
                success: function(result) {
                    model = result;
                    iteration = Ext.create(model,{
                        'StartDate': monday_morning,
                        'EndDate': tuesday_evening
                    });
                    
                    iteration.setCFD(Ext.Array.merge(cfd_monday,cfd_tuesday,cfd_wednesday));
                    
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
            expect(iteration.get('__days').length).toEqual(2);
            expect(iteration.get('__dailyScope').length).toEqual(2);
            expect(iteration.get('__dailyScope')).toEqual([4,6]);
            expect(iteration.get('__startScope')).toEqual(4);
            expect(iteration.get('__endScope')).toEqual(6);
            
        });
    });
    
    it("should populate __scope with a total plan estimate each day with nulls for dates that have no data",function(){
        runs(function(){
            Rally.technicalservices.ModelBuilder.build('Iteration','tsIteration',[]).then({
                success: function(result) {
                    model = result;
                    iteration = Ext.create(model,{
                        'StartDate': monday_morning,
                        'EndDate': wednesday_evening
                    });
                    
                    iteration.setCFD(Ext.Array.merge(cfd_monday,cfd_tuesday));
                    
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
            expect(iteration.get('__days').length).toEqual(3);
            expect(iteration.get('__dailyScope').length).toEqual(3);
            expect(iteration.get('__dailyScope')).toEqual([4,6,null]);
            expect(iteration.get('__startScope')).toEqual(4);
            expect(iteration.get('__endScope')).toEqual(null);
        });
    });  
    
    it("should populate __scope with a total plan estimate each day",function(){
        runs(function(){
            Rally.technicalservices.ModelBuilder.build('Iteration','tsIteration',[]).then({
                success: function(result) {
                    model = result;
                    iteration = Ext.create(model,{
                        'StartDate': monday_morning,
                        'EndDate': monday_evening
                    });
                    
                    iteration.setCFD(cfd_monday);
                    
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
            expect(iteration.get('__dailyScope').length).toEqual(1);
            expect(iteration.get('__dailyScope')).toEqual([4]);
            expect(iteration.get('__startScope')).toEqual(4);
            expect(iteration.get('__endScope')).toEqual(4);
        });
    });
    
    it("should populate __scope with a total plan estimate each day ignoring CFD from other iterations",function(){
        runs(function(){
            Rally.technicalservices.ModelBuilder.build('Iteration','tsIteration',[]).then({
                success: function(result) {
                    model = result;
                    iteration = Ext.create(model,{
                        'StartDate': monday_morning,
                        'EndDate': monday_evening,
                        'ObjectID': 7
                    });
                    
                    iteration.setCFD(Ext.Array.merge(cfd_monday,cfd_monday_other_oid));
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
            expect(iteration.get('__dailyScope').length).toEqual(1);
            expect(iteration.get('__dailyScope')).toEqual([4]);
            expect(iteration.get('__startScope')).toEqual(4);
            expect(iteration.get('__endScope')).toEqual(4);
        });
        
    });
    
    it("should deal with _scope when there is no data yet",function(){
        runs(function(){
            Rally.technicalservices.ModelBuilder.build('Iteration','tsIteration',[]).then({
                success: function(result) {
                    model = result;
                    iteration = Ext.create(model,{
                        'StartDate': monday_morning,
                        'EndDate': monday_evening,
                        'ObjectID': 7
                    });
                    
                    iteration.setCFD([]);
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
            expect(iteration.get('__dailyScope').length).toEqual(1);
            expect(iteration.get('__dailyScope')).toEqual([null]);
            expect(iteration.get('__startScope')).toEqual(null);
            expect(iteration.get('__endScope')).toEqual(null);
        });
        
    });  
    
    
});
