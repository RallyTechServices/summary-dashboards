describe("When making an extended iteration model with the modelbuilder", function() {
    var model;
    var ready_to_test;
        
    beforeEach(function(){
        model = null;
        ready_to_test = false;
    });
    
    it("should have the iteration's regular fields",function(){
        runs(function(){
            Rally.technicalservices.ModelBuilder.build('Iteration','tsIteration',[]).then({
                success: function(result) {
                    model = result;
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
            expect(model.getName()).toEqual('tsIteration');
            expect(model.getField('Name')['name']).toEqual('Name');
            expect(model.getField('StartDate')['name']).toEqual('StartDate');
            expect(model.getField('Shazbot')).toEqual(null);
        });
    });
    
    it("should have default added fields",function(){
        runs(function(){          
            Rally.technicalservices.ModelBuilder.build('Iteration','tsIteration',[]).then({
                success: function(result) {
                    model = result;
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
            expect(model.getName()).toEqual('tsIteration');
            expect(model.getField('__startScope')['name']).toEqual('__startScope');
            expect(model.getField('__endScope')['name']).toEqual('__endScope');
            expect(model.getField('__endAcceptance')['name']).toEqual('__endAcceptance');
            expect(model.getField('__dailyScope')['name']).toEqual('__dailyScope');
            expect(model.getField('__dailyAcceptance')['name']).toEqual('__dailyAcceptance');
            expect(model.getField('__days')['name']).toEqual('__days');
        });
    });
    
        
    it("should have allow further additional fields",function(){
        
        var new_field_cfg = {
            name: 'Shazbot',
            displayName: 'Shazbot 1',
            convert: function(value, record) {
                return value || "Gotcha!";
            }
        };
        
        runs(function(){          
            Rally.technicalservices.ModelBuilder.build('Iteration','tsIteration',[new_field_cfg]).then({
                success: function(result) {
                    model = result;
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
            expect(model.getField('Shazbot')['name']).toEqual('Shazbot');
            expect(model.getField('Shazbot')['displayName']).toEqual('Shazbot 1');
            expect(model.getField('Shazbot')['convert']).toEqual(new_field_cfg['convert']);

        });
    });
    
});
