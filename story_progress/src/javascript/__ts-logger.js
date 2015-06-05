/*
 */
Ext.define('Rally.technicalservices.Logger',{
    constructor: function(config){
        Ext.apply(this,config);
    },
    log: function(){
        var timestamp = "[ " + Ext.util.Format.date(new Date(), "Y-m-d H:i:s.u") + " ]";
        //var output_args = arguments;
        //output_args.unshift( [ "[ " + timestamp + " ]" ] );
        //output_args = Ext.Array.push(output_args,arguments);
        
//        var output_args = [];
//        output_args = Ext.Array.push(output_args,[timestamp]);
//        output_args = Ext.Array.push(output_args, Ext.Array.slice(arguments,0));
//
//        window.console && console.log.apply(console,output_args);
            var i = -1, l = arguments.length, args = [], fn = 'console.log(args)';
            while(++i<l){
                args.push('args['+i+']');
            };
            fn = new Function('args',fn.replace(/args/,args.join(',')));
            fn(arguments);
    }

});
