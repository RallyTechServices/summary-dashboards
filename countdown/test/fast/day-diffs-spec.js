describe("When calculating date differences", function() {
    var clock;
    
    beforeEach(function(){
        clock = Ext.create('Rally.technicalservices.CountDownClock',{});
    });
    
    it("should return 1 for 1 day different",function(){
        var saturday = new Date(2013,08,07,5,0,0);
        var sunday = new Date(2013,08,08,5,0,0);

        var diff = clock.calculateDifferences(sunday,saturday);
        expect(diff.days).toBe(1);
    });
    
    it("should return 1 for a little more than 1 day",function(){
        var saturday = new Date(2013,08,07,5,0,0);
        var sunday = new Date(2013,08,08,12,0,0);

        var diff = clock.calculateDifferences(sunday,saturday);
        expect(diff.days).toBe(1);
    });
    
    it("should return 0 for same day",function(){
        var five = new Date(2013,08,07,5,0,0);
        var six = new Date(2013,08,07,6,0,0);

        var diff = clock.calculateDifferences(six,five);
        expect(diff.days).toBe(0);
    });
    
    it("should return 0 for yesterday less than 24 hours ago",function(){
        var saturday = new Date(2013,08,07,5,0,0);
        var sunday = new Date(2013,08,08,4,0,0);

        var diff = clock.calculateDifferences(sunday,saturday);
        expect(diff.days).toBe(0);
    });
    
    it("should return 0 if end date is in the past",function(){
        var saturday = new Date(2013,08,07,5,0,0);
        var monday = new Date(2013,08,09,5,0,0);

        var diff = clock.calculateDifferences(saturday,monday);
        expect(diff.days).toBe(0);
    });
    
    
});
