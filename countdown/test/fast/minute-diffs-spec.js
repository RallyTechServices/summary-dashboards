describe("When calculating minute differences", function() {
    var clock;
    
    beforeEach(function(){
        clock = Ext.create('Rally.technicalservices.CountDownClock',{});
    });
    
    it("should return 5 for five minutes ago",function(){
        var future = new Date(2013,08,07,6,10,0);
        var past   = new Date(2013,08,07,6,05,0);

        var diff = clock.calculateDifferences(future,past);
        expect(diff.minutes).toBe(5);
    });
    
    it("should return 10 for 2 hours and 10 minutes ago",function(){
        var future  = new Date(2013,08,07,6,25,0);
        var past    = new Date(2013,08,07,4,15,0);

        var diff = clock.calculateDifferences(future,past);
        expect(diff.minutes).toBe(10);
    });
    
    it("should return 10 for 24 hours and 10 minutes ago",function(){
        var future  = new Date(2013,08,07,6,35,0);
        var past    = new Date(2013,08,06,6,25,0);

        var diff = clock.calculateDifferences(future,past);
        expect(diff.minutes).toBe(10);
    });
    
        
    it("should return 5 for five days and an hour and 5 minutes ago",function(){
        var today     = new Date(2013,08,07,5,10,0);
        var other_day = new Date(2013,08,02,4,05,0);

        var diff = clock.calculateDifferences(today,other_day);
        expect(diff.minutes).toBe(5);
    });
    
    it("should return 0 for less than a minute ago",function(){
        var future  = new Date(2013,08,07,5,30,0);
        var past    = new Date(2013,08,07,5,39,05);

        var diff = clock.calculateDifferences(future,past);
        expect(diff.minutes).toBe(0);
    });
    
    it("should return 0 for the future",function(){
        var future = new Date(2013,08,07,5,30,0);
        var past   = new Date(2013,08,07,5,0,0);

        var diff = clock.calculateDifferences(past,future);
        expect(diff.minutes).toBe(0);
    });
    
});
