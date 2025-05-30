const contactService = require('./contactService');

class IdentityService {
    
    async identifyContact(email, phoneNumber) {
        // Step 1: Find existing contacts by email or phone
        const existingContacts = await contactService.findContactsByEmailOrPhone(email, phoneNumber);
        
        if (existingContacts.length === 0) {
            // No existing contacts - create new primary contact
            const newContact = await contactService.createContact(email, phoneNumber);
            return this.buildResponse(newContact);
        }

        // Step 2: Group contacts by their primary contact
        const primaryGroups = await this.groupContactsByPrimary(existingContacts);
        
        if (primaryGroups.length === 1) {
            // All contacts belong to same primary
            const primaryContact = primaryGroups[0].primary;
            
            // Check if this exact combination already exists
            const allLinkedContacts = await contactService.getAllLinkedContacts(primaryContact.id);
            const exactMatch = allLinkedContacts.find(contact => 
                contact.email === email && contact.phone_number === phoneNumber
            );
            
            if (exactMatch) {
                // Exact contact already exists, just return response
                return this.buildResponse(primaryContact);
            }
            
            // Check if this adds new information
            const hasNewInformation = this.checkForNewInformation(allLinkedContacts, email, phoneNumber);
            
            if (hasNewInformation) {
                // Create new secondary contact with new information
                await contactService.createContact(email, phoneNumber, primaryContact.id, 'secondary');
            }
            
            return this.buildResponse(primaryContact);
        }

        if (primaryGroups.length === 2) {
            // Two different primary contacts need to be merged
            const oldestPrimary = primaryGroups.reduce((oldest, current) => 
                new Date(current.primary.created_at) < new Date(oldest.primary.created_at) ? current : oldest
            );
            
            const newerPrimary = primaryGroups.find(group => group.primary.id !== oldestPrimary.primary.id);
            
            // Update newer primary to secondary
            await contactService.updateContactToSecondary(newerPrimary.primary.id, oldestPrimary.primary.id);
            
            // Update all contacts linked to newer primary
            await contactService.updateLinkedContacts(newerPrimary.primary.id, oldestPrimary.primary.id);
            
            // Always create new secondary contact for the merge request
            await contactService.createContact(email, phoneNumber, oldestPrimary.primary.id, 'secondary');
            
            return this.buildResponse(oldestPrimary.primary);
        }

        // Handle case with more than 2 primary groups (shouldn't happen normally)
        if (primaryGroups.length > 2) {
            // Find the oldest primary among all groups
            const oldestPrimary = primaryGroups.reduce((oldest, current) => 
                new Date(current.primary.created_at) < new Date(oldest.primary.created_at) ? current : oldest
            );
            
            // Convert all other primaries to secondary
            for (const group of primaryGroups) {
                if (group.primary.id !== oldestPrimary.primary.id) {
                    await contactService.updateContactToSecondary(group.primary.id, oldestPrimary.primary.id);
                    await contactService.updateLinkedContacts(group.primary.id, oldestPrimary.primary.id);
                }
            }
            
            // Create new secondary contact for the request
            await contactService.createContact(email, phoneNumber, oldestPrimary.primary.id, 'secondary');
            
            return this.buildResponse(oldestPrimary.primary);
        }

        // Fallback
        const oldestContact = existingContacts.reduce((oldest, current) => 
            new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest
        );
        const primaryId = oldestContact.linked_id || oldestContact.id;
        const primaryContact = oldestContact.link_precedence === 'primary' 
            ? oldestContact 
            : await contactService.getContactById(primaryId);
        return this.buildResponse(primaryContact);
    }

    checkForNewInformation(existingContacts, requestEmail, requestPhone) {
        const existingEmails = existingContacts
            .map(c => c.email)
            .filter(email => email !== null && email !== undefined);
        
        const existingPhones = existingContacts
            .map(c => c.phone_number)
            .filter(phone => phone !== null && phone !== undefined);

        const hasNewEmail = requestEmail && !existingEmails.includes(requestEmail);
        const hasNewPhone = requestPhone && !existingPhones.includes(requestPhone);

        return hasNewEmail || hasNewPhone;
    }

    async groupContactsByPrimary(contacts) {
        const primaryMap = new Map();
        
        // First pass: identify all primary contacts
        for (const contact of contacts) {
            if (contact.link_precedence === 'primary') {
                primaryMap.set(contact.id, {
                    primary: contact,
                    secondaries: []
                });
            }
        }
        
        // Second pass: group secondary contacts with their primaries
        for (const contact of contacts) {
            if (contact.link_precedence === 'secondary' && contact.linked_id) {
                if (primaryMap.has(contact.linked_id)) {
                    primaryMap.get(contact.linked_id).secondaries.push(contact);
                } else {
                    // Primary not found in current results, fetch it
                    const primaryContact = await contactService.getContactById(contact.linked_id);
                    if (primaryContact) {
                        primaryMap.set(primaryContact.id, {
                            primary: primaryContact,
                            secondaries: [contact]
                        });
                    }
                }
            }
        }
        
        return Array.from(primaryMap.values());
    }

    async buildResponse(primaryContact) {
        const allLinkedContacts = await contactService.getAllLinkedContacts(primaryContact.id);
        
        const emails = [];
        const phoneNumbers = [];
        const secondaryContactIds = [];
        
        // Process primary contact first
        const primary = allLinkedContacts.find(c => c.link_precedence === 'primary');
        if (primary.email) emails.push(primary.email);
        if (primary.phone_number) phoneNumbers.push(primary.phone_number);
        
        // Process secondary contacts
        const secondaries = allLinkedContacts.filter(c => c.link_precedence === 'secondary');
        secondaries.forEach(contact => {
            if (contact.email && !emails.includes(contact.email)) {
                emails.push(contact.email);
            }
            if (contact.phone_number && !phoneNumbers.includes(contact.phone_number)) {
                phoneNumbers.push(contact.phone_number);
            }
            secondaryContactIds.push(contact.id);
        });

        return {
            contact: {
                primaryContatctId: primary.id,
                emails: emails,
                phoneNumbers: phoneNumbers,
                secondaryContactIds: secondaryContactIds
            }
        };
    }
}

module.exports = new IdentityService();
