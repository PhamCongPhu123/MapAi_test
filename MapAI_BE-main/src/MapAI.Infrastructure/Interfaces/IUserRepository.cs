using MapAI.Domain.Entities;

namespace MapAI.Infrastructure.Interfaces
{
    public interface IUserRepository
    {
        Task<UserEntity?> GetByIdAsync(string id);
        Task<UserEntity?> GetByEmailAsync(string email);
        Task<UserEntity?> GetByIdOrEmailAsync(string search);
        Task<IEnumerable<UserEntity>> GetAllAsync();
        Task<bool> AddAsync(UserEntity entity);
        Task<bool> UpdateAsync(UserEntity entity);
        Task<bool> DeleteAsync(string id);
        Task<bool> ExistsByEmailAsync(string email);
    }
}
