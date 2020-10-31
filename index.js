const AWS = require("aws-sdk");

exports.handler = async (event) => {
    // 0 - Setup clients
    const ec2Client = new AWS.EC2();
    const snsClient = new AWS.SNS();
    let unattachedEIPs = [];

    // 1 - Get available EIPs that are unattached per region
    const eipsResponse = await ec2Client.describeAddresses({}).promise();
    
    if (eipsResponse.Addresses.length > 0){
        for (const eip of eipsResponse.Addresses){
            if (!("InstanceId" in eip)){
                unattachedEIPs.push(eip);
                console.log(`unattached EIP: ${eip}`);
            }
        }
    }
    
    // 2 - Construct payload of message
    let message = [];
    if (unattachedEIPs.length === 0)
        return;
    
    message.push("List of unattached EIPs: \n");
    for (const eipWithRegion of unattachedEIPs){
        message.push(`Region: ${eipWithRegion.NetworkBorderGroup} EIP: ${eipWithRegion.PublicIp}\n`);
    }
    const payload = message.join("");
    console.log(`Payload:\n ${payload}`);
    
    // 3 - Notifiy
    await snsClient.publish({
        TopicArn: "arn:aws:sns:ap-southeast-2:472971161478:EIPCheckNotifier",
        Message: payload,
    }).promise();
    console.log("Published to topic");
    
    return {
        statusCode: 200
    };
};