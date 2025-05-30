const supabase = require('./supabaseClient');

class ContactService {
    
    // Get contact by ID
    async getContactById(contactId) {
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', contactId)
            .is('deleted_at', null)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    // Find contacts by email or phone (but not both null)
    async findContactsByEmailOrPhone(email, phoneNumber) {
        let query = supabase
            .from('contacts')
            .select('*')
            .is('deleted_at', null);

        if (email && phoneNumber) {
            query = query.or(`email.eq.${email},phone_number.eq.${phoneNumber}`);
        } else if (email) {
            query = query.eq('email', email);
        } else if (phoneNumber) {
            query = query.eq('phone_number', phoneNumber);
        }

        const { data, error } = await query.order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    }

    // Get all linked contacts for a primary contact
    async getAllLinkedContacts(primaryId) {
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .or(`id.eq.${primaryId},linked_id.eq.${primaryId}`)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data || [];
    }

    // Create a new contact
    async createContact(email, phoneNumber, linkedId = null, linkPrecedence = 'primary') {
        const { data, error } = await supabase
            .from('contacts')
            .insert([{
                email,
                phone_number: phoneNumber,
                linked_id: linkedId,
                link_precedence: linkPrecedence,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    // Update contact to secondary
    async updateContactToSecondary(contactId, primaryId) {
        const { data, error } = await supabase
            .from('contacts')
            .update({
                linked_id: primaryId,
                link_precedence: 'secondary',
                updated_at: new Date().toISOString()
            })
            .eq('id', contactId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    // Update all contacts linked to old primary to new primary
    async updateLinkedContacts(oldPrimaryId, newPrimaryId) {
        const { data, error } = await supabase
            .from('contacts')
            .update({
                linked_id: newPrimaryId,
                updated_at: new Date().toISOString()
            })
            .eq('linked_id', oldPrimaryId)
            .select();
        
        if (error) throw error;
        return data || [];
    }

    // Check if contact already exists with exact same data
    async findExactContact(email, phoneNumber) {
        let query = supabase
            .from('contacts')
            .select('*')
            .is('deleted_at', null);

        if (email && phoneNumber) {
            query = query.eq('email', email).eq('phone_number', phoneNumber);
        } else if (email) {
            query = query.eq('email', email).is('phone_number', null);
        } else if (phoneNumber) {
            query = query.eq('phone_number', phoneNumber).is('email', null);
        }

        const { data, error } = await query.single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }
}

module.exports = new ContactService();
