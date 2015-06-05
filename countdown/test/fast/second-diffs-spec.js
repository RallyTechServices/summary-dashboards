describe("When calculating seconds differences", function() {
    var clock;
    
    beforeEach(function(){
        clock = Ext.create('Rally.technicalservices.CountDownClock',{});
    });
    
    it("should return 5 for five seconds ago",function(){
        var future = new Date(2013,08,07,6,10,5);
        var past   = new Date(2013,08,07,6,10,0);

        var diff = clock.calculateDifferences(future,past);
        expect(diff.seconds).toBe(5);
    });
    
    it("should return 10 for 2 hours, 5 minutes and 10 seconds ago",function(){
        var future  = new Date(2013,08,07,6,25,10);
        var past    = new Date(2013,08,07,4,20,0);

        var diff = clock.calculateDifferences(future,past);
        expect(diff.seconds).toBe(10);
    });
    
    it("should return 10 for 24 hours and 10 seconds ago",function(){
        var future  = new Date(2013,08,07,6,35,15);
        var past    = new Date(2013,08,06,6,35,5);

        var diff = clock.calculateDifferences(future,past);
        expect(diff.seconds).toBe(10);
    });
    
        
    it("should return 5 for five days and an hour and 5 seconds ago",function(){
        var future  = new Date(2013,08,07,5,10,20);
        var past    = new Date(2013,08,02,4,10,15);

        var diff = clock.calculateDifferences(future,past);
        expect(diff.seconds).toBe(5);
    });
    
    it("should return 0 the same time",function(){
        var future  = new Date(2013,08,07,5,30,05);
        var past    = new Date(2013,08,07,5,30,05);

        var diff = clock.calculateDifferences(future,past);
        expect(diff.seconds).toBe(0);
    });
    
    it("should return 0 for the future",function(){
        var future = new Date(2013,08,07,5,30,50);
        var past   = new Date(2013,08,07,5,30,0);

        var diff = clock.calculateDifferences(past,future);
        expect(diff.seconds).toBe(0);
    });
    
});
