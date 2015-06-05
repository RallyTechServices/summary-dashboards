describe("When calculating hour differences", function() {
    var clock;
    
    beforeEach(function(){
        clock = Ext.create('Rally.technicalservices.CountDownClock',{});
    });
    
    it("should return 1 for an hour ago",function(){
        var five = new Date(2013,08,07,5,0,0);
        var six = new Date(2013,08,07,6,0,0);

        var diff = clock.calculateDifferences(six,five);
        expect(diff.hours).toBe(1);
    });
    
    it("should return 23 for almost a day ago",function(){
        var today     = new Date(2013,08,07,5,0,0);
        var yesterday = new Date(2013,08,06,6,0,0);

        var diff = clock.calculateDifferences(today,yesterday);
        expect(diff.hours).toBe(23);
    });
    
    it("should return 1 for one day and an hour ago",function(){
        var today     = new Date(2013,08,07,5,0,0);
        var yesterday = new Date(2013,08,06,4,0,0);

        var diff = clock.calculateDifferences(today,yesterday);
        expect(diff.hours).toBe(1);
    });
    
        
    it("should return 1 for five days and an hour ago",function(){
        var today     = new Date(2013,08,07,5,0,0);
        var other_day = new Date(2013,08,02,4,0,0);

        var diff = clock.calculateDifferences(today,other_day);
        expect(diff.hours).toBe(1);
    });
    
    it("should return 0 for less than an hour ago",function(){
        var today         = new Date(2013,08,07,5,0,0);
        var half_hour_ago = new Date(2013,08,07,4,30,0);

        var diff = clock.calculateDifferences(today,half_hour_ago);
        expect(diff.hours).toBe(0);
    });
    
    it("should return 0 for the future",function(){
        var today = new Date(2013,08,07,5,0,0);
        var yesterday = new Date(2013,08,07,4,0,0);

        var diff = clock.calculateDifferences(yesterday,today);
        expect(diff.hours).toBe(0);
    });
    
});
