namespace CBS_Harita.Models
{
    public class Userinfo
    {
        public int Id { get; set; }
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
        public string Name { get; set; } = "";
        public string Surname { get; set; } = "";
        public string Role { get; set; } = ""; 
        public string? Bolge { get; set; }    
        public string? City { get; set; }     
    }
}